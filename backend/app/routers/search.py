from __future__ import annotations

from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Article, Signal, Theme, Top100Stock

router = APIRouter(prefix="/api/search", tags=["search"])


class StockResult(BaseModel):
    id: int
    ticker: str
    company_name: str
    exchange: str
    sector: Optional[str]
    model_config = {"from_attributes": True}


class SignalResult(BaseModel):
    id: int
    stock_ticker: str
    stock_name: Optional[str]
    sentiment: str
    confidence: float
    direction: Optional[str]
    reasoning: Optional[str]
    created_at: Optional[datetime]
    model_config = {"from_attributes": True}


class ArticleResult(BaseModel):
    id: int
    title: str
    source: str
    published_at: Optional[datetime]
    processed: bool
    model_config = {"from_attributes": True}


class ThemeResult(BaseModel):
    id: int
    name: str
    description: Optional[str]
    sector: Optional[str]
    relevance_score: Optional[float]
    model_config = {"from_attributes": True}


class SearchResponse(BaseModel):
    stocks: List[StockResult]
    signals: List[SignalResult]
    articles: List[ArticleResult]
    themes: List[ThemeResult]
    query: str


@router.get("", response_model=SearchResponse)
def search(
    q: str = Query(..., min_length=1, max_length=100),
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
):
    """Search across stocks, signals, articles, and themes."""
    term = f"%{q}%"

    # Stocks: search by ticker or company name
    stocks = (
        db.query(Top100Stock)
        .filter(
            (Top100Stock.ticker.ilike(term)) |
            (Top100Stock.company_name.ilike(term))
        )
        .limit(limit)
        .all()
    )

    # Signals: search by ticker, stock name, or reasoning
    signals = (
        db.query(Signal)
        .filter(
            (Signal.stock_ticker.ilike(term)) |
            (Signal.stock_name.ilike(term)) |
            (Signal.reasoning.ilike(term))
        )
        .order_by(Signal.created_at.desc())
        .limit(limit)
        .all()
    )

    # Articles: search by title or summary
    articles = (
        db.query(Article)
        .filter(
            (Article.title.ilike(term)) |
            (Article.summary.ilike(term))
        )
        .order_by(Article.published_at.desc())
        .limit(limit)
        .all()
    )

    # Themes: search by name or description
    themes = (
        db.query(Theme)
        .filter(
            (Theme.name.ilike(term)) |
            (Theme.description.ilike(term))
        )
        .order_by(Theme.relevance_score.desc())
        .limit(limit)
        .all()
    )

    return SearchResponse(
        stocks=[StockResult.model_validate(s) for s in stocks],
        signals=[SignalResult.model_validate(s) for s in signals],
        articles=[ArticleResult.model_validate(a) for a in articles],
        themes=[ThemeResult.model_validate(t) for t in themes],
        query=q,
    )
