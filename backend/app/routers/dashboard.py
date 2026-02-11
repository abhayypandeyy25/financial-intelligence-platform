from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional, List, Dict

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import Article, Signal, BacktestResult, Theme, SentimentData, StockQuote

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


# --- Enhanced Dashboard ---

class SectorHeatmapEntry(BaseModel):
    sector: str
    signal_count: int
    avg_sentiment_score: float
    avg_price_change: Optional[float]
    top_ticker: Optional[str]
    accuracy: Optional[float]


class PipelineStats(BaseModel):
    total_sources: int
    articles_ingested_today: int
    articles_processed_today: int
    signals_generated_today: int
    backtests_run_today: int
    sentiment_posts_today: int
    last_ingestion_time: Optional[str]


class EnhancedDashboard(DashboardSummary):
    overall_sentiment_trend: str
    sentiment_change_vs_yesterday: Optional[float]
    sector_heatmap: List[SectorHeatmapEntry]
    pipeline_stats: PipelineStats


@router.get("/enhanced", response_model=EnhancedDashboard)
def get_enhanced_dashboard(db: Session = Depends(get_db)):
    """Enhanced dashboard with sector heatmap, pipeline stats, and sentiment trend."""
    # Reuse base summary logic
    base = get_dashboard_summary(db)
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday = today - timedelta(days=1)
    week_ago = datetime.utcnow() - timedelta(days=7)

    # --- Overall sentiment trend ---
    pos = base.signals_by_sentiment.get("positive", 0)
    neg = base.signals_by_sentiment.get("negative", 0)
    total_sent = pos + neg + base.signals_by_sentiment.get("neutral", 0)
    if total_sent == 0:
        sentiment_trend = "neutral"
    elif pos > neg * 1.5:
        sentiment_trend = "bullish"
    elif neg > pos * 1.5:
        sentiment_trend = "bearish"
    else:
        sentiment_trend = "mixed"

    # Sentiment change vs yesterday
    yesterday_signals = db.query(Signal).filter(
        Signal.created_at >= yesterday, Signal.created_at < today
    ).all()
    if yesterday_signals:
        yd_pos = sum(1 for s in yesterday_signals if s.sentiment == "positive")
        yd_total = len(yesterday_signals)
        yd_ratio = yd_pos / yd_total if yd_total else 0
        today_ratio = pos / total_sent if total_sent else 0
        sentiment_change = round((today_ratio - yd_ratio) * 100, 1)
    else:
        sentiment_change = None

    # --- Sector heatmap ---
    heatmap = []
    sectors_data = (
        db.query(
            Signal.sector,
            func.count(Signal.id),
            func.avg(Signal.confidence),
        )
        .filter(Signal.created_at >= week_ago, Signal.sector.isnot(None))
        .group_by(Signal.sector)
        .all()
    )

    sentiment_map = {"positive": 1.0, "neutral": 0.0, "negative": -1.0}

    for sector, count, avg_conf in sectors_data:
        # Average sentiment score for sector
        sector_signals = (
            db.query(Signal)
            .filter(Signal.sector == sector, Signal.created_at >= week_ago)
            .all()
        )
        avg_sent = sum(sentiment_map.get(s.sentiment, 0) for s in sector_signals) / max(1, len(sector_signals))

        # Top ticker by signal count in sector
        top = (
            db.query(Signal.stock_ticker, func.count(Signal.id).label("cnt"))
            .filter(Signal.sector == sector, Signal.created_at >= week_ago)
            .group_by(Signal.stock_ticker)
            .order_by(func.count(Signal.id).desc())
            .first()
        )

        # Avg price change for sector tickers
        sector_tickers = [s.stock_ticker for s in sector_signals]
        if sector_tickers:
            avg_price_change_row = (
                db.query(func.avg(StockQuote.percent_change))
                .filter(StockQuote.ticker.in_(set(sector_tickers)))
                .scalar()
            )
            avg_price_change = round(float(avg_price_change_row), 2) if avg_price_change_row else None
        else:
            avg_price_change = None

        # Accuracy for sector
        sector_bts = (
            db.query(BacktestResult)
            .filter(BacktestResult.ticker.in_(set(sector_tickers)))
            .all()
        )
        acc_vals = [b.accurate_7d for b in sector_bts if b.accurate_7d is not None]
        accuracy = round(sum(acc_vals) / len(acc_vals) * 100, 1) if acc_vals else None

        heatmap.append(SectorHeatmapEntry(
            sector=sector,
            signal_count=count,
            avg_sentiment_score=round(avg_sent, 2),
            avg_price_change=avg_price_change,
            top_ticker=top[0] if top else None,
            accuracy=accuracy,
        ))

    heatmap.sort(key=lambda x: x.signal_count, reverse=True)

    # --- Pipeline stats ---
    articles_ingested_today = db.query(Article).filter(Article.ingested_at >= today).count()
    articles_processed_today = db.query(Article).filter(
        Article.processed == True, Article.ingested_at >= today
    ).count()
    signals_today_count = db.query(Signal).filter(Signal.created_at >= today).count()
    backtests_today = db.query(BacktestResult).filter(BacktestResult.created_at >= today).count()
    sentiment_today = db.query(SentimentData).filter(SentimentData.ingested_at >= today).count()

    last_article = db.query(Article).order_by(Article.ingested_at.desc()).first()
    last_ingestion = last_article.ingested_at.isoformat() if last_article and last_article.ingested_at else None

    from app.config import get_settings
    settings = get_settings()
    total_sources = len(settings.news_sources) + len(settings.sentiment_sources) + (1 if settings.twitter_bearer_token else 0)

    pipeline = PipelineStats(
        total_sources=total_sources,
        articles_ingested_today=articles_ingested_today,
        articles_processed_today=articles_processed_today,
        signals_generated_today=signals_today_count,
        backtests_run_today=backtests_today,
        sentiment_posts_today=sentiment_today,
        last_ingestion_time=last_ingestion,
    )

    return EnhancedDashboard(
        **base.model_dump(),
        overall_sentiment_trend=sentiment_trend,
        sentiment_change_vs_yesterday=sentiment_change,
        sector_heatmap=heatmap,
        pipeline_stats=pipeline,
    )


class NarrativeResponse(BaseModel):
    narrative: str


@router.get("/narrative", response_model=NarrativeResponse)
def get_narrative(db: Session = Depends(get_db)):
    """AI-generated market briefing (cached 15 minutes)."""
    from app.agents.narrative import generate_narrative
    narrative = generate_narrative(db)
    return NarrativeResponse(narrative=narrative)
