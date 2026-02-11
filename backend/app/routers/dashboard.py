from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional, List, Dict

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import Article, Signal, BacktestResult, Theme

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


class DashboardSummary(BaseModel):
    total_articles: int
    total_signals: int
    signals_today: int
    total_backtests: int
    accuracy_1d: Optional[float]
    accuracy_7d: Optional[float]
    active_themes: int
    latest_signals: List[dict]
    signals_by_sentiment: Dict[str, int]
    signals_by_sector: Dict[str, int]


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(db: Session = Depends(get_db)):
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    total_articles = db.query(Article).count()
    total_signals = db.query(Signal).count()
    signals_today = db.query(Signal).filter(Signal.created_at >= today).count()
    total_backtests = db.query(BacktestResult).count()

    # Accuracy
    bt_results = db.query(BacktestResult).all()
    acc_1d_vals = [r.accurate_1d for r in bt_results if r.accurate_1d is not None]
    acc_7d_vals = [r.accurate_7d for r in bt_results if r.accurate_7d is not None]
    accuracy_1d = round(sum(acc_1d_vals) / len(acc_1d_vals) * 100, 1) if acc_1d_vals else None
    accuracy_7d = round(sum(acc_7d_vals) / len(acc_7d_vals) * 100, 1) if acc_7d_vals else None

    active_themes = db.query(Theme).filter(
        Theme.created_at >= datetime.utcnow() - timedelta(days=7)
    ).count()

    # Latest signals
    latest = db.query(Signal).order_by(Signal.created_at.desc()).limit(5).all()
    latest_signals = []
    for s in latest:
        article = db.query(Article).filter(Article.id == s.article_id).first()
        latest_signals.append({
            "id": s.id,
            "ticker": s.stock_ticker,
            "stock_name": s.stock_name,
            "sentiment": s.sentiment,
            "confidence": s.confidence,
            "direction": s.direction,
            "reasoning": s.reasoning,
            "article_title": article.title if article else None,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        })

    # Sentiment distribution
    sentiments = db.query(Signal.sentiment, func.count(Signal.id)).group_by(Signal.sentiment).all()
    signals_by_sentiment = {s: c for s, c in sentiments}

    # Sector distribution
    sectors = db.query(Signal.sector, func.count(Signal.id)).filter(
        Signal.sector.isnot(None)
    ).group_by(Signal.sector).all()
    signals_by_sector = {s: c for s, c in sectors}

    return DashboardSummary(
        total_articles=total_articles,
        total_signals=total_signals,
        signals_today=signals_today,
        total_backtests=total_backtests,
        accuracy_1d=accuracy_1d,
        accuracy_7d=accuracy_7d,
        active_themes=active_themes,
        latest_signals=latest_signals,
        signals_by_sentiment=signals_by_sentiment,
        signals_by_sector=signals_by_sector,
    )
