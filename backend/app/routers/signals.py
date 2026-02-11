from __future__ import annotations

from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Article, Signal, StockQuote, BacktestResult
from app.agents.pipeline import process_unprocessed_articles

router = APIRouter(prefix="/api/signals", tags=["signals"])


class SignalResponse(BaseModel):
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


class ProcessResponse(BaseModel):
    articles_processed: int
    signals_generated: int


@router.get("", response_model=List[SignalResponse])
def list_signals(
    ticker: Optional[str] = None,
    sentiment: Optional[str] = None,
    sector: Optional[str] = None,
    min_confidence: Optional[float] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    query = db.query(Signal).order_by(Signal.created_at.desc())
    if ticker:
        query = query.filter(Signal.stock_ticker == ticker)
    if sentiment:
        query = query.filter(Signal.sentiment == sentiment)
    if sector:
        query = query.filter(Signal.sector == sector)
    if min_confidence is not None:
        query = query.filter(Signal.confidence >= min_confidence)

    signals = query.offset(skip).limit(limit).all()

    results = []
    for s in signals:
        article = db.query(Article).filter(Article.id == s.article_id).first()
        r = SignalResponse.model_validate(s)
        if article:
            r.article_title = article.title
            r.article_source = article.source
        results.append(r)
    return results


@router.get("/{signal_id}", response_model=SignalResponse)
def get_signal(signal_id: int, db: Session = Depends(get_db)):
    signal = db.query(Signal).filter(Signal.id == signal_id).first()
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")
    article = db.query(Article).filter(Article.id == signal.article_id).first()
    r = SignalResponse.model_validate(signal)
    if article:
        r.article_title = article.title
        r.article_source = article.source
    return r


class ArticleForSignal(BaseModel):
    id: int
    title: str
    summary: Optional[str]
    source: str
    url: str
    published_at: Optional[datetime]
    processed: bool
    model_config = {"from_attributes": True}


class QuoteForSignal(BaseModel):
    ticker: str
    current_price: Optional[float]
    percent_change: Optional[float]
    volume: Optional[int]
    model_config = {"from_attributes": True}


class BacktestForSignal(BaseModel):
    id: int
    price_at_signal: Optional[float]
    actual_1d_change: Optional[float]
    actual_7d_change: Optional[float]
    actual_30d_change: Optional[float]
    accurate_1d: Optional[bool]
    accurate_7d: Optional[bool]
    accurate_30d: Optional[bool]
    model_config = {"from_attributes": True}


class SignalDetailResponse(SignalResponse):
    article: Optional[ArticleForSignal] = None
    stock_quote: Optional[QuoteForSignal] = None
    backtest: Optional[BacktestForSignal] = None
    related_signals: List[SignalResponse] = []


@router.get("/{signal_id}/detail", response_model=SignalDetailResponse)
def get_signal_detail(signal_id: int, db: Session = Depends(get_db)):
    """Get comprehensive signal detail with article, stock quote, backtest, and related signals."""
    signal = db.query(Signal).filter(Signal.id == signal_id).first()
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")

    # Base signal
    r = SignalDetailResponse.model_validate(signal)

    # Article
    article = db.query(Article).filter(Article.id == signal.article_id).first()
    if article:
        r.article_title = article.title
        r.article_source = article.source
        r.article = ArticleForSignal.model_validate(article)

    # Latest stock quote
    from sqlalchemy import desc as sql_desc
    quote = (
        db.query(StockQuote)
        .filter(StockQuote.ticker == signal.stock_ticker)
        .order_by(sql_desc(StockQuote.ingested_at))
        .first()
    )
    if quote:
        r.stock_quote = QuoteForSignal.model_validate(quote)

    # Backtest result
    bt = db.query(BacktestResult).filter(BacktestResult.signal_id == signal_id).first()
    if bt:
        r.backtest = BacktestForSignal.model_validate(bt)

    # Related signals (same ticker, excluding self, max 5)
    related = (
        db.query(Signal)
        .filter(Signal.stock_ticker == signal.stock_ticker, Signal.id != signal_id)
        .order_by(Signal.created_at.desc())
        .limit(5)
        .all()
    )
    for s in related:
        sr = SignalResponse.model_validate(s)
        art = db.query(Article).filter(Article.id == s.article_id).first()
        if art:
            sr.article_title = art.title
            sr.article_source = art.source
        r.related_signals.append(sr)

    return r


@router.post("/process", response_model=ProcessResponse)
def trigger_processing(db: Session = Depends(get_db)):
    result = process_unprocessed_articles(db)
    return ProcessResponse(**result)
