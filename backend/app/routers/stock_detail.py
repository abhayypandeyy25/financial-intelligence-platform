from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models import Article, Signal, StockQuote, BacktestResult, SentimentData, Top100Stock

router = APIRouter(prefix="/api/stocks", tags=["stock-detail"])


class ArticleBrief(BaseModel):
    id: int
    title: str
    summary: Optional[str]
    source: str
    url: str
    published_at: Optional[datetime]
    processed: bool
    model_config = {"from_attributes": True}


class SignalBrief(BaseModel):
    id: int
    article_id: int
    stock_ticker: str
    stock_name: Optional[str]
    sector: Optional[str]
    sentiment: str
    confidence: float
    reasoning: Optional[str]
    direction: Optional[str]
    impact_hypothesis: Optional[str]
    time_horizon: Optional[str]
    insight_type: Optional[str]
    created_at: Optional[datetime]
    article_title: Optional[str] = None
    article_source: Optional[str] = None
    model_config = {"from_attributes": True}


class BacktestBrief(BaseModel):
    id: int
    signal_id: int
    ticker: str
    signal_date: Optional[datetime]
    direction_predicted: str
    price_at_signal: Optional[float]
    price_1d: Optional[float]
    price_7d: Optional[float]
    actual_1d_change: Optional[float]
    actual_7d_change: Optional[float]
    accurate_1d: Optional[bool]
    accurate_7d: Optional[bool]
    model_config = {"from_attributes": True}


class QuoteBrief(BaseModel):
    id: int
    ticker: str
    company_name: Optional[str]
    exchange: Optional[str]
    current_price: Optional[float]
    open_price: Optional[float]
    high_price: Optional[float]
    low_price: Optional[float]
    previous_close: Optional[float]
    volume: Optional[int]
    market_cap: Optional[int]
    pe_ratio: Optional[float]
    dividend_yield: Optional[float]
    price_change: Optional[float]
    percent_change: Optional[float]
    source: str
    quote_time: Optional[datetime]
    ingested_at: Optional[datetime]
    model_config = {"from_attributes": True}


class SentimentBrief(BaseModel):
    id: int
    source: str
    source_type: str
    content: str
    author: Optional[str]
    url: str
    posted_at: Optional[datetime]
    upvotes: int
    comments_count: int
    tickers_mentioned: Optional[str]
    sentiment: Optional[str]
    confidence: Optional[float]
    model_config = {"from_attributes": True}


class SentimentSummaryBrief(BaseModel):
    total_mentions: int
    positive_count: int
    negative_count: int
    neutral_count: int
    avg_confidence: Optional[float]
    avg_upvotes: float
    total_comments: int


class StockDetailResponse(BaseModel):
    ticker: str
    company_name: Optional[str]
    sector: Optional[str]
    exchange: Optional[str]
    quote: Optional[QuoteBrief]
    signals: List[SignalBrief]
    sentiment_summary: Optional[SentimentSummaryBrief]
    recent_sentiment: List[SentimentBrief]
    backtest_results: List[BacktestBrief]
    related_articles: List[ArticleBrief]


@router.get("/{ticker}/detail", response_model=StockDetailResponse)
def get_stock_detail(ticker: str, db: Session = Depends(get_db)):
    """Get comprehensive detail for a single stock: quote, signals, sentiment, backtest, articles."""
    ticker_upper = ticker.upper()

    # Company info from Top100Stock
    stock_info = db.query(Top100Stock).filter(Top100Stock.ticker == ticker_upper).first()

    # Latest quote
    quote = (
        db.query(StockQuote)
        .filter(StockQuote.ticker == ticker_upper)
        .order_by(desc(StockQuote.ingested_at))
        .first()
    )

    # Signals for this ticker (last 30 days, max 20)
    signals_raw = (
        db.query(Signal)
        .filter(Signal.stock_ticker == ticker_upper)
        .order_by(desc(Signal.created_at))
        .limit(20)
        .all()
    )
    signals = []
    for s in signals_raw:
        sb = SignalBrief.model_validate(s)
        article = db.query(Article).filter(Article.id == s.article_id).first()
        if article:
            sb.article_title = article.title
            sb.article_source = article.source
        signals.append(sb)

    # Related articles (via signals)
    article_ids = list({s.article_id for s in signals_raw})
    articles = []
    if article_ids:
        articles_raw = db.query(Article).filter(Article.id.in_(article_ids)).order_by(desc(Article.published_at)).all()
        articles = [ArticleBrief.model_validate(a) for a in articles_raw]

    # Backtest results for this ticker
    backtests = (
        db.query(BacktestResult)
        .filter(BacktestResult.ticker == ticker_upper)
        .order_by(desc(BacktestResult.created_at))
        .limit(20)
        .all()
    )
    backtest_list = [BacktestBrief.model_validate(b) for b in backtests]

    # Sentiment data (posts mentioning this ticker, last 30 days)
    cutoff = datetime.utcnow() - timedelta(days=30)
    sentiment_posts = (
        db.query(SentimentData)
        .filter(
            SentimentData.tickers_mentioned.contains(ticker_upper),
            SentimentData.ingested_at >= cutoff,
        )
        .order_by(desc(SentimentData.posted_at))
        .limit(20)
        .all()
    )
    recent_sentiment = [SentimentBrief.model_validate(p) for p in sentiment_posts]

    # Sentiment summary
    sentiment_summary = None
    if sentiment_posts:
        positive = sum(1 for p in sentiment_posts if p.sentiment == "positive")
        negative = sum(1 for p in sentiment_posts if p.sentiment == "negative")
        neutral = sum(1 for p in sentiment_posts if p.sentiment == "neutral")
        confidences = [p.confidence for p in sentiment_posts if p.confidence is not None]
        avg_conf = sum(confidences) / len(confidences) if confidences else None
        sentiment_summary = SentimentSummaryBrief(
            total_mentions=len(sentiment_posts),
            positive_count=positive,
            negative_count=negative,
            neutral_count=neutral,
            avg_confidence=round(avg_conf, 4) if avg_conf else None,
            avg_upvotes=round(sum(p.upvotes for p in sentiment_posts) / len(sentiment_posts), 1),
            total_comments=sum(p.comments_count for p in sentiment_posts),
        )

    return StockDetailResponse(
        ticker=ticker_upper,
        company_name=stock_info.company_name if stock_info else (quote.company_name if quote else None),
        sector=stock_info.sector if stock_info else None,
        exchange=stock_info.exchange if stock_info else (quote.exchange if quote else None),
        quote=QuoteBrief.model_validate(quote) if quote else None,
        signals=signals,
        sentiment_summary=sentiment_summary,
        recent_sentiment=recent_sentiment,
        backtest_results=backtest_list,
        related_articles=articles,
    )
