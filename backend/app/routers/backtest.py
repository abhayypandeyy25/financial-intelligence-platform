from __future__ import annotations

from datetime import datetime
from typing import Optional, List, Dict

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import BacktestResult, Signal
from app.services.backtest import run_backtest_for_unvalidated

router = APIRouter(prefix="/api/backtest", tags=["backtest"])


class BacktestResultResponse(BaseModel):
    id: int
    signal_id: int
    ticker: str
    signal_date: datetime
    direction_predicted: str
    price_at_signal: Optional[float]
    price_1d: Optional[float]
    price_7d: Optional[float]
    price_30d: Optional[float]
    actual_1d_change: Optional[float]
    actual_7d_change: Optional[float]
    actual_30d_change: Optional[float]
    accurate_1d: Optional[bool]
    accurate_7d: Optional[bool]
    accurate_30d: Optional[bool]

    model_config = {"from_attributes": True}


class BacktestSummary(BaseModel):
    total_signals_tested: int
    accuracy_1d: Optional[float]
    accuracy_7d: Optional[float]
    accuracy_30d: Optional[float]
    by_sector: Dict[str, dict]
    avg_confidence: Optional[float]


class RunBacktestResponse(BaseModel):
    signals_tested: int
    results_created: int


@router.get("/results", response_model=List[BacktestResultResponse])
def list_backtest_results(
    ticker: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    query = db.query(BacktestResult).order_by(BacktestResult.signal_date.desc())
    if ticker:
        query = query.filter(BacktestResult.ticker == ticker)
    return query.offset(skip).limit(limit).all()


@router.get("/summary", response_model=BacktestSummary)
def get_backtest_summary(db: Session = Depends(get_db)):
    results = db.query(BacktestResult).all()
    if not results:
        return BacktestSummary(
            total_signals_tested=0,
            accuracy_1d=None, accuracy_7d=None, accuracy_30d=None,
            by_sector={}, avg_confidence=None,
        )

    total = len(results)
    acc_1d = [r.accurate_1d for r in results if r.accurate_1d is not None]
    acc_7d = [r.accurate_7d for r in results if r.accurate_7d is not None]
    acc_30d = [r.accurate_30d for r in results if r.accurate_30d is not None]

    # Group by sector
    sector_data: dict[str, dict] = {}
    for r in results:
        signal = db.query(Signal).filter(Signal.id == r.signal_id).first()
        sector = signal.sector if signal else "Unknown"
        if sector not in sector_data:
            sector_data[sector] = {"total": 0, "accurate_1d": 0, "accurate_7d": 0, "count_1d": 0, "count_7d": 0}
        sector_data[sector]["total"] += 1
        if r.accurate_1d is not None:
            sector_data[sector]["count_1d"] += 1
            if r.accurate_1d:
                sector_data[sector]["accurate_1d"] += 1
        if r.accurate_7d is not None:
            sector_data[sector]["count_7d"] += 1
            if r.accurate_7d:
                sector_data[sector]["accurate_7d"] += 1

    for sector in sector_data:
        d = sector_data[sector]
        d["accuracy_1d"] = round(d["accurate_1d"] / d["count_1d"] * 100, 1) if d["count_1d"] > 0 else None
        d["accuracy_7d"] = round(d["accurate_7d"] / d["count_7d"] * 100, 1) if d["count_7d"] > 0 else None

    # Average confidence of tested signals
    signal_ids = [r.signal_id for r in results]
    signals = db.query(Signal).filter(Signal.id.in_(signal_ids)).all()
    avg_conf = sum(s.confidence for s in signals) / len(signals) if signals else None

    return BacktestSummary(
        total_signals_tested=total,
        accuracy_1d=round(sum(acc_1d) / len(acc_1d) * 100, 1) if acc_1d else None,
        accuracy_7d=round(sum(acc_7d) / len(acc_7d) * 100, 1) if acc_7d else None,
        accuracy_30d=round(sum(acc_30d) / len(acc_30d) * 100, 1) if acc_30d else None,
        by_sector=sector_data,
        avg_confidence=round(avg_conf, 3) if avg_conf else None,
    )


@router.post("/run", response_model=RunBacktestResponse)
def trigger_backtest(db: Session = Depends(get_db)):
    result = run_backtest_for_unvalidated(db)
    return RunBacktestResponse(**result)
