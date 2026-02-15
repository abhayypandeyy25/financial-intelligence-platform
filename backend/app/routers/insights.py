from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import Signal, BacktestResult, StockQuote

router = APIRouter(prefix="/api/insights", tags=["insights"])

SENTIMENT_MAP = {"positive": 1.0, "neutral": 0.0, "negative": -1.0}


class TopPick(BaseModel):
    ticker: str
    stock_name: Optional[str] = None
    sector: Optional[str] = None
    direction: str
    composite_score: float
    signal_confidence: float
    backtest_accuracy_7d: Optional[float] = None
    sentiment_score: float
    signal_count: int
    reasoning: Optional[str] = None
    impact_hypothesis: Optional[str] = None
    time_horizon: Optional[str] = None
    latest_signal_id: int
    current_price: Optional[float] = None
    percent_change: Optional[float] = None


@router.get("/top-picks", response_model=List[TopPick])
def get_top_picks(
    limit: int = Query(default=8, ge=1, le=20),
    min_confidence: float = Query(default=0.6, ge=0.0, le=1.0),
    time_horizon: Optional[str] = Query(default=None),
    direction: str = Query(default="up"),
    db: Session = Depends(get_db),
):
    """AI-ranked top investment picks based on signal confidence, backtest accuracy, and sector sentiment."""
    week_ago = datetime.utcnow() - timedelta(days=7)

    # 1. Query recent high-confidence signals
    query = db.query(Signal).filter(
        Signal.confidence >= min_confidence,
        Signal.created_at >= week_ago,
    )
    if direction:
        query = query.filter(Signal.direction == direction)
    if time_horizon:
        query = query.filter(Signal.time_horizon == time_horizon)

    signals = query.order_by(Signal.confidence.desc()).all()

    if not signals:
        return []

    # 2. Group by ticker, keep highest-confidence signal per ticker
    ticker_best: dict[str, Signal] = {}
    ticker_count: dict[str, int] = {}
    for s in signals:
        ticker_count[s.stock_ticker] = ticker_count.get(s.stock_ticker, 0) + 1
        if s.stock_ticker not in ticker_best or s.confidence > ticker_best[s.stock_ticker].confidence:
            ticker_best[s.stock_ticker] = s

    # 3. Get backtest accuracy per ticker
    tickers = list(ticker_best.keys())
    bt_results = db.query(BacktestResult).filter(BacktestResult.ticker.in_(tickers)).all()

    ticker_accuracy: dict[str, float | None] = {}
    for ticker in tickers:
        ticker_bts = [b for b in bt_results if b.ticker == ticker]
        acc_vals = [b.accurate_7d for b in ticker_bts if b.accurate_7d is not None]
        ticker_accuracy[ticker] = round(sum(acc_vals) / len(acc_vals) * 100, 1) if acc_vals else None

    # 4. Get sector sentiment scores
    sector_signals = (
        db.query(Signal)
        .filter(Signal.created_at >= week_ago, Signal.sector.isnot(None))
        .all()
    )
    sector_sentiment: dict[str, float] = {}
    sector_groups: dict[str, list] = {}
    for s in sector_signals:
        sector_groups.setdefault(s.sector, []).append(s)
    for sector, sigs in sector_groups.items():
        avg = sum(SENTIMENT_MAP.get(s.sentiment, 0) for s in sigs) / max(1, len(sigs))
        sector_sentiment[sector] = avg

    # 5. Get current stock prices
    latest_quotes: dict[str, StockQuote] = {}
    quotes = db.query(StockQuote).filter(StockQuote.ticker.in_(tickers)).all()
    for q in quotes:
        existing = latest_quotes.get(q.ticker)
        if not existing or (q.ingested_at and existing.ingested_at and q.ingested_at > existing.ingested_at):
            latest_quotes[q.ticker] = q

    # 6. Compute composite scores and build response
    picks: list[TopPick] = []
    for ticker, signal in ticker_best.items():
        conf = signal.confidence
        acc = ticker_accuracy.get(ticker)
        sent = sector_sentiment.get(signal.sector, 0) if signal.sector else 0

        # Composite: confidence * 40 + accuracy * 35 + sentiment * 25
        # Normalize: confidence is 0-1 (scale to 0-100), accuracy is 0-100 or None, sentiment is -1 to 1 (scale to 0-100)
        conf_score = conf * 100
        acc_score = acc if acc is not None else 50  # default to 50% if no backtest data
        sent_score = (sent + 1) * 50  # maps [-1, 1] to [0, 100]

        composite = round(conf_score * 0.4 + acc_score * 0.35 + sent_score * 0.25, 1)

        quote = latest_quotes.get(ticker)

        picks.append(TopPick(
            ticker=ticker,
            stock_name=signal.stock_name,
            sector=signal.sector,
            direction=signal.direction or direction,
            composite_score=composite,
            signal_confidence=round(conf, 3),
            backtest_accuracy_7d=acc,
            sentiment_score=round(sent, 2),
            signal_count=ticker_count.get(ticker, 1),
            reasoning=signal.reasoning,
            impact_hypothesis=signal.impact_hypothesis,
            time_horizon=signal.time_horizon,
            latest_signal_id=signal.id,
            current_price=quote.current_price if quote else None,
            percent_change=quote.percent_change if quote else None,
        ))

    # Sort by composite score descending
    picks.sort(key=lambda p: p.composite_score, reverse=True)

    return picks[:limit]
