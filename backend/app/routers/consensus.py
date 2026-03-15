"""API endpoints for signal consensus via multi-agent debate."""

from __future__ import annotations

import json
import threading
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ConsensusResult, Signal, Simulation, SimulationProject
from app.services.mirofish_client import MiroFishClient, MiroFishUnavailableError
from app.services.financial_ontology import (
    build_financial_documents,
    build_investor_profiles,
    map_signals_to_requirement,
)

router = APIRouter(prefix="/api/consensus", tags=["consensus"])

# In-memory task tracking for async consensus runs
_consensus_tasks: dict[str, dict] = {}


class ConsensusRunRequest(BaseModel):
    signal_id: int


class ConsensusBatchRequest(BaseModel):
    signal_ids: list[int]


@router.post("/run")
async def run_consensus(request: ConsensusRunRequest, db: Session = Depends(get_db)):
    """Start a consensus analysis for a single signal."""
    signal = db.query(Signal).filter(Signal.id == request.signal_id).first()
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")

    # Check if consensus already exists
    existing = (
        db.query(ConsensusResult)
        .filter(ConsensusResult.signal_id == request.signal_id)
        .first()
    )
    if existing:
        return {
            "status": "exists",
            "consensus_id": existing.id,
            "message": "Consensus already exists for this signal",
        }

    task_id = f"consensus_{request.signal_id}_{int(datetime.utcnow().timestamp())}"
    _consensus_tasks[task_id] = {
        "status": "pending",
        "signal_id": request.signal_id,
        "progress": 0,
        "message": "Starting consensus analysis...",
    }

    # Run consensus in background thread
    thread = threading.Thread(
        target=_run_consensus_background,
        args=(task_id, request.signal_id),
        daemon=True,
    )
    thread.start()

    return {"task_id": task_id, "status": "started"}


def _run_consensus_background(task_id: str, signal_id: int):
    """Background task to run consensus analysis."""
    import asyncio

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(_run_consensus_async(task_id, signal_id))
    except Exception as e:
        _consensus_tasks[task_id] = {
            "status": "failed",
            "signal_id": signal_id,
            "progress": 0,
            "message": str(e),
            "error": str(e),
        }
    finally:
        loop.close()


async def _run_consensus_async(task_id: str, signal_id: int):
    """Async consensus workflow using MiroFish pipeline."""
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        signal = db.query(Signal).filter(Signal.id == signal_id).first()
        if not signal:
            raise ValueError(f"Signal {signal_id} not found")

        _consensus_tasks[task_id]["status"] = "processing"
        _consensus_tasks[task_id]["progress"] = 10
        _consensus_tasks[task_id]["message"] = "Building financial documents..."

        # Build documents from signal's article and related context
        article_ids = [signal.article_id] if signal.article_id else None
        documents = build_financial_documents(
            article_ids=article_ids, signal_ids=[signal_id], db=db
        )

        if not documents:
            raise ValueError("No documents available for consensus analysis")

        requirement = map_signals_to_requirement(
            f"{signal.stock_ticker} {signal.direction} signal with "
            f"{signal.confidence:.0%} confidence. {signal.reasoning or ''}"
        )

        client = MiroFishClient()

        # Step 1: Generate ontology
        _consensus_tasks[task_id]["progress"] = 20
        _consensus_tasks[task_id]["message"] = "Generating ontology..."
        ontology_resp = await client.generate_ontology(
            document_texts=documents,
            simulation_requirement=requirement,
            project_name=f"consensus_{signal.stock_ticker}_{signal_id}",
        )

        if not ontology_resp.get("success"):
            raise ValueError(f"Ontology generation failed: {ontology_resp.get('error')}")

        project_id = ontology_resp["data"]["project_id"]

        # Save simulation project
        sim_project = SimulationProject(
            mirofish_project_id=project_id,
            name=f"Consensus: {signal.stock_ticker} Signal #{signal_id}",
            project_type="consensus",
            status="ontology_generated",
            source_signal_ids=json.dumps([signal_id]),
            source_article_ids=json.dumps(article_ids or []),
        )
        db.add(sim_project)
        db.commit()

        # Step 2: Build graph
        _consensus_tasks[task_id]["progress"] = 30
        _consensus_tasks[task_id]["message"] = "Building knowledge graph..."
        build_resp = await client.build_graph(project_id)

        if not build_resp.get("success"):
            raise ValueError(f"Graph build failed: {build_resp.get('error')}")

        graph_task_id = build_resp["data"]["task_id"]

        # Poll graph build completion
        import asyncio
        for _ in range(120):  # 4 minute timeout
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

        # Step 3: Create simulation
        _consensus_tasks[task_id]["progress"] = 50
        _consensus_tasks[task_id]["message"] = "Creating simulation with investor agents..."
        sim_resp = await client.create_simulation(
            project_id=project_id,
            graph_id=graph_id,
            enable_twitter=True,
            enable_reddit=False,
        )

        if not sim_resp.get("success"):
            raise ValueError(f"Simulation creation failed: {sim_resp.get('error')}")

        mirofish_sim_id = sim_resp["data"]["simulation_id"]

        simulation = Simulation(
            project_id=sim_project.id,
            mirofish_simulation_id=mirofish_sim_id,
            simulation_type="signal_consensus",
            status="created",
            started_at=datetime.utcnow(),
        )
        db.add(simulation)
        db.commit()

        # Step 4: Prepare simulation
        _consensus_tasks[task_id]["progress"] = 60
        _consensus_tasks[task_id]["message"] = "Preparing investor agent profiles..."
        prep_resp = await client.prepare_simulation(
            simulation_id=mirofish_sim_id,
            simulation_requirement=requirement,
            document_text="\n\n---\n\n".join(documents[:3]),
        )

        # Step 5: Start simulation
        _consensus_tasks[task_id]["progress"] = 70
        _consensus_tasks[task_id]["message"] = "Running agent debate simulation..."
        start_resp = await client.start_simulation(
            simulation_id=mirofish_sim_id,
            platform="twitter",
            max_rounds=10,
        )

        # Poll simulation completion
        for _ in range(180):  # 6 minute timeout
            await asyncio.sleep(2)
            run_status = await client.get_run_status(mirofish_sim_id)
            if run_status.get("success"):
                state = run_status.get("data", {})
                runner_status = state.get("runner_status", "")
                if runner_status in ("completed", "COMPLETED"):
                    break
                if runner_status in ("failed", "FAILED"):
                    raise ValueError("Simulation failed")
        else:
            raise ValueError("Simulation timed out")

        simulation.status = "completed"
        simulation.completed_at = datetime.utcnow()
        db.commit()

        # Step 6: Generate report
        _consensus_tasks[task_id]["progress"] = 85
        _consensus_tasks[task_id]["message"] = "Generating consensus report..."
        report_resp = await client.generate_report(mirofish_sim_id)

        # For now, create a consensus result with simulated scores
        # In production, the report agent output would be parsed for actual consensus
        _consensus_tasks[task_id]["progress"] = 95
        _consensus_tasks[task_id]["message"] = "Extracting consensus results..."

        consensus = ConsensusResult(
            simulation_id=simulation.id,
            signal_id=signal_id,
            consensus_score=0.0,  # Will be populated from report parsing
            agreement_ratio=0.0,
            bull_count=0,
            bear_count=0,
            neutral_count=0,
            debate_summary="Consensus analysis completed. Full results available in the simulation report.",
        )
        db.add(consensus)
        db.commit()

        _consensus_tasks[task_id] = {
            "status": "completed",
            "signal_id": signal_id,
            "progress": 100,
            "message": "Consensus analysis complete",
            "consensus_id": consensus.id,
        }

    except MiroFishUnavailableError as e:
        _consensus_tasks[task_id] = {
            "status": "failed",
            "signal_id": signal_id,
            "progress": 0,
            "message": f"MiroFish unavailable: {e}",
            "error": str(e),
        }
    except Exception as e:
        _consensus_tasks[task_id] = {
            "status": "failed",
            "signal_id": signal_id,
            "progress": 0,
            "message": str(e),
            "error": str(e),
        }
    finally:
        db.close()


@router.get("/status/{task_id}")
async def get_consensus_status(task_id: str):
    """Poll the status of a consensus task."""
    task = _consensus_tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("/{signal_id}")
async def get_consensus(signal_id: int, db: Session = Depends(get_db)):
    """Get consensus result for a signal."""
    result = (
        db.query(ConsensusResult)
        .filter(ConsensusResult.signal_id == signal_id)
        .order_by(ConsensusResult.created_at.desc())
        .first()
    )
    if not result:
        raise HTTPException(status_code=404, detail="No consensus found for this signal")

    return {
        "id": result.id,
        "signal_id": result.signal_id,
        "consensus_score": result.consensus_score,
        "agreement_ratio": result.agreement_ratio,
        "bull_count": result.bull_count,
        "bear_count": result.bear_count,
        "neutral_count": result.neutral_count,
        "debate_summary": result.debate_summary,
        "key_arguments_bull": json.loads(result.key_arguments_bull) if result.key_arguments_bull else [],
        "key_arguments_bear": json.loads(result.key_arguments_bear) if result.key_arguments_bear else [],
        "created_at": result.created_at.isoformat() if result.created_at else None,
    }


@router.get("/recent")
async def get_recent_consensus(limit: int = 20, db: Session = Depends(get_db)):
    """List recent consensus results."""
    results = (
        db.query(ConsensusResult)
        .order_by(ConsensusResult.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": r.id,
            "signal_id": r.signal_id,
            "consensus_score": r.consensus_score,
            "agreement_ratio": r.agreement_ratio,
            "bull_count": r.bull_count,
            "bear_count": r.bear_count,
            "neutral_count": r.neutral_count,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in results
    ]
