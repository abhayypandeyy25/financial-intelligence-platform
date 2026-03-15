"""API endpoints for market scenario simulation."""

from __future__ import annotations

import json
import threading
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ScenarioImpact, Simulation, SimulationProject
from app.services.mirofish_client import MiroFishClient, MiroFishUnavailableError
from app.services.financial_ontology import (
    build_scenario_documents,
    map_signals_to_requirement,
)
from app.config import get_settings

router = APIRouter(prefix="/api/scenarios", tags=["scenarios"])

settings = get_settings()

# In-memory task tracking
_scenario_tasks: dict[str, dict] = {}


class ScenarioRunRequest(BaseModel):
    scenario_text: str
    target_tickers: list[str] | None = None
    sectors: list[str] | None = None
    max_rounds: int = 15


@router.post("/run")
async def run_scenario(request: ScenarioRunRequest, db: Session = Depends(get_db)):
    """Start a scenario simulation."""
    task_id = f"scenario_{int(datetime.utcnow().timestamp())}"
    _scenario_tasks[task_id] = {
        "status": "pending",
        "progress": 0,
        "message": "Starting scenario simulation...",
        "scenario_text": request.scenario_text,
    }

    # Auto-detect affected tickers from sectors if not specified
    target_tickers = request.target_tickers or []
    if not target_tickers and request.sectors:
        for ticker, sector in settings.stock_sectors.items():
            if sector in request.sectors:
                target_tickers.append(ticker)

    thread = threading.Thread(
        target=_run_scenario_background,
        args=(task_id, request.scenario_text, target_tickers, request.max_rounds),
        daemon=True,
    )
    thread.start()

    return {"task_id": task_id, "status": "started"}


def _run_scenario_background(
    task_id: str, scenario_text: str, target_tickers: list[str], max_rounds: int
):
    import asyncio

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(
            _run_scenario_async(task_id, scenario_text, target_tickers, max_rounds)
        )
    except Exception as e:
        _scenario_tasks[task_id] = {
            "status": "failed",
            "progress": 0,
            "message": str(e),
            "error": str(e),
        }
    finally:
        loop.close()


async def _run_scenario_async(
    task_id: str, scenario_text: str, target_tickers: list[str], max_rounds: int
):
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        _scenario_tasks[task_id]["status"] = "processing"
        _scenario_tasks[task_id]["progress"] = 10
        _scenario_tasks[task_id]["message"] = "Building scenario documents..."

        documents = build_scenario_documents(
            scenario_text=scenario_text,
            target_tickers=target_tickers,
            db=db,
        )

        requirement = map_signals_to_requirement(scenario_text)

        client = MiroFishClient()

        # Step 1: Ontology
        _scenario_tasks[task_id]["progress"] = 20
        _scenario_tasks[task_id]["message"] = "Generating ontology..."
        ontology_resp = await client.generate_ontology(
            document_texts=documents,
            simulation_requirement=requirement,
            project_name=f"scenario_{int(datetime.utcnow().timestamp())}",
        )

        if not ontology_resp.get("success"):
            raise ValueError(f"Ontology generation failed: {ontology_resp.get('error')}")

        project_id = ontology_resp["data"]["project_id"]

        sim_project = SimulationProject(
            mirofish_project_id=project_id,
            name=f"Scenario: {scenario_text[:100]}",
            description=scenario_text,
            project_type="scenario",
            status="ontology_generated",
        )
        db.add(sim_project)
        db.commit()

        # Step 2: Build graph
        _scenario_tasks[task_id]["progress"] = 30
        _scenario_tasks[task_id]["message"] = "Building knowledge graph..."
        build_resp = await client.build_graph(project_id)

        if not build_resp.get("success"):
            raise ValueError(f"Graph build failed: {build_resp.get('error')}")

        graph_task_id = build_resp["data"]["task_id"]

        # Poll
        import asyncio
        for _ in range(120):
            await asyncio.sleep(2)
            status = await client.get_task_status(graph_task_id)
            if status.get("success") and status["data"].get("status") == "completed":
                graph_id = status["data"].get("result", {}).get("graph_id")
                break
            if status.get("success") and status["data"].get("status") == "failed":
                raise ValueError(f"Graph build failed: {status['data'].get('error')}")
        else:
            raise ValueError("Graph build timed out")

        sim_project.graph_id = graph_id
        sim_project.status = "graph_completed"
        db.commit()

        # Step 3: Create + prepare simulation
        _scenario_tasks[task_id]["progress"] = 50
        _scenario_tasks[task_id]["message"] = "Creating simulation..."
        sim_resp = await client.create_simulation(
            project_id=project_id,
            graph_id=graph_id,
            enable_twitter=True,
            enable_reddit=True,
        )

        if not sim_resp.get("success"):
            raise ValueError(f"Simulation creation failed: {sim_resp.get('error')}")

        mirofish_sim_id = sim_resp["data"]["simulation_id"]

        simulation = Simulation(
            project_id=sim_project.id,
            mirofish_simulation_id=mirofish_sim_id,
            simulation_type="scenario",
            status="created",
            scenario_description=scenario_text,
            started_at=datetime.utcnow(),
        )
        db.add(simulation)
        db.commit()

        _scenario_tasks[task_id]["progress"] = 60
        _scenario_tasks[task_id]["message"] = "Preparing agents..."
        await client.prepare_simulation(
            simulation_id=mirofish_sim_id,
            simulation_requirement=requirement,
            document_text="\n\n---\n\n".join(documents[:3]),
        )

        # Step 4: Start simulation
        _scenario_tasks[task_id]["progress"] = 70
        _scenario_tasks[task_id]["message"] = "Running scenario simulation..."
        await client.start_simulation(
            simulation_id=mirofish_sim_id,
            platform="parallel",
            max_rounds=max_rounds,
        )

        # Poll simulation
        for _ in range(180):
            await asyncio.sleep(2)
            run_status = await client.get_run_status(mirofish_sim_id)
            if run_status.get("success"):
                state = run_status.get("data", {})
                runner_status = state.get("runner_status", "")
                current_round = state.get("current_round", 0)
                total_rounds = state.get("total_rounds", max_rounds)
                _scenario_tasks[task_id]["message"] = (
                    f"Simulating... Round {current_round}/{total_rounds}"
                )
                if runner_status in ("completed", "COMPLETED"):
                    break
                if runner_status in ("failed", "FAILED"):
                    raise ValueError("Simulation failed")
        else:
            raise ValueError("Simulation timed out")

        simulation.status = "completed"
        simulation.completed_at = datetime.utcnow()
        db.commit()

        # Step 5: Create placeholder impacts (to be populated by report parsing)
        _scenario_tasks[task_id]["progress"] = 90
        _scenario_tasks[task_id]["message"] = "Extracting impact predictions..."

        for ticker in target_tickers[:20]:
            impact = ScenarioImpact(
                simulation_id=simulation.id,
                ticker=ticker,
                predicted_direction="neutral",
                predicted_magnitude=0.0,
                confidence=0.0,
                reasoning="Impact analysis pending report generation.",
            )
            db.add(impact)
        db.commit()

        _scenario_tasks[task_id] = {
            "status": "completed",
            "progress": 100,
            "message": "Scenario simulation complete",
            "simulation_id": simulation.id,
            "mirofish_simulation_id": mirofish_sim_id,
        }

    except MiroFishUnavailableError as e:
        _scenario_tasks[task_id] = {
            "status": "failed",
            "progress": 0,
            "message": f"MiroFish unavailable: {e}",
            "error": str(e),
        }
    except Exception as e:
        _scenario_tasks[task_id] = {
            "status": "failed",
            "progress": 0,
            "message": str(e),
            "error": str(e),
        }
    finally:
        db.close()


@router.get("/status/{task_id}")
async def get_scenario_status(task_id: str):
    task = _scenario_tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("/history")
async def get_scenario_history(limit: int = 20, db: Session = Depends(get_db)):
    simulations = (
        db.query(Simulation)
        .filter(Simulation.simulation_type == "scenario")
        .order_by(Simulation.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": s.id,
            "scenario_description": s.scenario_description,
            "status": s.status,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "impact_count": len(s.scenario_impacts),
        }
        for s in simulations
    ]


@router.get("/{simulation_id}")
async def get_scenario(simulation_id: int, db: Session = Depends(get_db)):
    simulation = db.query(Simulation).filter(Simulation.id == simulation_id).first()
    if not simulation:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return {
        "id": simulation.id,
        "scenario_description": simulation.scenario_description,
        "status": simulation.status,
        "mirofish_simulation_id": simulation.mirofish_simulation_id,
        "report_id": simulation.report_id,
        "started_at": simulation.started_at.isoformat() if simulation.started_at else None,
        "completed_at": simulation.completed_at.isoformat() if simulation.completed_at else None,
    }


@router.get("/{simulation_id}/impacts")
async def get_scenario_impacts(simulation_id: int, db: Session = Depends(get_db)):
    impacts = (
        db.query(ScenarioImpact)
        .filter(ScenarioImpact.simulation_id == simulation_id)
        .all()
    )
    return [
        {
            "id": i.id,
            "ticker": i.ticker,
            "predicted_direction": i.predicted_direction,
            "predicted_magnitude": i.predicted_magnitude,
            "confidence": i.confidence,
            "sentiment_shift": i.sentiment_shift,
            "reasoning": i.reasoning,
        }
        for i in impacts
    ]
