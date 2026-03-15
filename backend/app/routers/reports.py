"""API endpoints for AI report generation and viewing."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Simulation
from app.services.mirofish_client import MiroFishClient, MiroFishUnavailableError

router = APIRouter(prefix="/api/reports", tags=["reports"])


class ReportGenerateRequest(BaseModel):
    simulation_id: int


class ReportChatRequest(BaseModel):
    report_id: str
    message: str
    history: list[dict] | None = None


@router.post("/generate")
async def generate_report(request: ReportGenerateRequest, db: Session = Depends(get_db)):
    """Generate an analysis report for a completed simulation."""
    simulation = db.query(Simulation).filter(Simulation.id == request.simulation_id).first()
    if not simulation:
        raise HTTPException(status_code=404, detail="Simulation not found")
    if simulation.status != "completed":
        raise HTTPException(status_code=400, detail="Simulation must be completed first")

    try:
        client = MiroFishClient()
        resp = await client.generate_report(simulation.mirofish_simulation_id)

        if resp.get("success"):
            report_id = resp.get("data", {}).get("report_id")
            simulation.report_id = report_id
            db.commit()
            return {
                "status": "generating",
                "report_id": report_id,
                "simulation_id": simulation.id,
            }
        else:
            raise HTTPException(status_code=500, detail=resp.get("error", "Report generation failed"))

    except MiroFishUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/{report_id}/progress")
async def get_report_progress(report_id: str):
    """Poll report generation progress."""
    try:
        client = MiroFishClient()
        resp = await client.get_report_status()
        return resp
    except MiroFishUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/{report_id}")
async def get_report(report_id: str):
    """Get a generated report."""
    try:
        client = MiroFishClient()
        resp = await client.get_report(report_id)
        if resp.get("success"):
            return resp["data"]
        raise HTTPException(status_code=404, detail="Report not found")
    except MiroFishUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/list")
async def list_reports(limit: int = 20, db: Session = Depends(get_db)):
    """List all simulations that have reports."""
    simulations = (
        db.query(Simulation)
        .filter(Simulation.report_id.isnot(None))
        .order_by(Simulation.completed_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": s.id,
            "simulation_type": s.simulation_type,
            "report_id": s.report_id,
            "scenario_description": s.scenario_description,
            "status": s.status,
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
        }
        for s in simulations
    ]


@router.post("/chat")
async def chat_with_report(request: ReportChatRequest):
    """Chat with the report agent about a report."""
    try:
        client = MiroFishClient()

        # We need the mirofish simulation_id — extract from report_id context
        resp = await client.chat_with_report_agent(
            simulation_id=request.report_id,  # report_id maps to simulation context
            message=request.message,
            history=request.history,
        )

        if resp.get("success"):
            return resp["data"]
        return {"response": resp.get("error", "Unable to generate response")}

    except MiroFishUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))
