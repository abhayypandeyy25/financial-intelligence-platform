from __future__ import annotations

from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models import StockQuote, Top100Stock

router = APIRouter(prefix="/api/stocks", tags=["stocks"])


class StockQuoteResponse(BaseModel):
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


class Top100StockResponse(BaseModel):
    id: int
    ticker: str
    company_name: str
    exchange: str
    sector: Optional[str]
    market_cap_rank: Optional[int]
    is_active: bool
    last_updated: Optional[datetime]

    model_config = {"from_attributes": True}


@router.get("/quotes", response_model=List[StockQuoteResponse])
def get_stock_quotes(
    ticker: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Get latest stock quotes, optionally filtered by ticker."""
    query = db.query(StockQuote)

    if ticker:
        query = query.filter(StockQuote.ticker == ticker.upper())

    # Get latest quote per ticker using subquery
    quotes = query.order_by(desc(StockQuote.ingested_at)).limit(limit).all()
    return quotes


@router.get("/quote/{ticker}", response_model=Optional[StockQuoteResponse])
def get_stock_quote(ticker: str, db: Session = Depends(get_db)):
    """Get latest quote for a specific ticker."""
    quote = (
        db.query(StockQuote)
        .filter(StockQuote.ticker == ticker.upper())
        .order_by(desc(StockQuote.ingested_at))
        .first()
    )
    return quote


@router.get("/top-100", response_model=List[Top100StockResponse])
def get_top_100_stocks(
    sector: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Get top 100 TSX stocks with optional sector filter."""
    query = db.query(Top100Stock).filter(Top100Stock.is_active == True)

    if sector:
        query = query.filter(Top100Stock.sector == sector)

    stocks = query.order_by(Top100Stock.market_cap_rank).all()
    return stocks


@router.get("/{ticker}/history", response_model=List[StockQuoteResponse])
def get_stock_history(
    ticker: str,
    limit: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Get historical quotes for a ticker."""
    quotes = (
        db.query(StockQuote)
        .filter(StockQuote.ticker == ticker.upper())
        .order_by(desc(StockQuote.ingested_at))
        .limit(limit)
        .all()
    )
    return quotes


@router.post("/refresh")
def refresh_stock_quotes(
    tickers: Optional[List[str]] = None,
    db: Session = Depends(get_db),
):
    """Manually trigger stock quote refresh."""
    from app.services.scrapers.stock_scrapers import YFinanceStockScraper

    scraper = YFinanceStockScraper()

    if tickers:
        quotes = scraper.fetch_quotes_batch(tickers, db=db)
    else:
        quotes = scraper.fetch_top_tsx_quotes(db=db)

    return {"refreshed": len(quotes), "tickers": [q.ticker for q in quotes]}
