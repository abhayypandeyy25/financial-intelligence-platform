from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional, List, Dict

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.database import get_db
from app.models import SentimentData

router = APIRouter(prefix="/api/sentiment", tags=["sentiment"])


class SentimentDataResponse(BaseModel):
    id: int
    source: str
    source_type: str
    content: str
    author: Optional[str]
    url: str
    posted_at: Optional[datetime]
    ingested_at: Optional[datetime]
    upvotes: int
    comments_count: int
    tickers_mentioned: Optional[str]
    sentiment: Optional[str]
    confidence: Optional[float]
    processed: bool

    model_config = {"from_attributes": True}


class SentimentSummary(BaseModel):
    ticker: str
    total_mentions: int
    positive_count: int
    negative_count: int
    neutral_count: int
    avg_confidence: Optional[float]
    avg_upvotes: float
    total_comments: int


@router.get("", response_model=List[SentimentDataResponse])
def get_sentiment_data(
    source: Optional[str] = None,
    ticker: Optional[str] = None,
    sentiment: Optional[str] = None,
    days: int = Query(7, ge=1, le=30),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Get sentiment data with filters."""
    query = db.query(SentimentData)

    # Date filter
    cutoff = datetime.utcnow() - timedelta(days=days)
    query = query.filter(SentimentData.ingested_at >= cutoff)

    if source:
        query = query.filter(SentimentData.source.contains(source))
    if ticker:
        query = query.filter(SentimentData.tickers_mentioned.contains(ticker.upper()))
    if sentiment:
        query = query.filter(SentimentData.sentiment == sentiment)

    posts = query.order_by(desc(SentimentData.posted_at)).offset(skip).limit(limit).all()
    return posts


@router.get("/summary/{ticker}", response_model=SentimentSummary)
def get_ticker_sentiment_summary(
    ticker: str,
    days: int = Query(7, ge=1, le=30),
    db: Session = Depends(get_db),
):
    """Get aggregated sentiment summary for a ticker."""
    cutoff = datetime.utcnow() - timedelta(days=days)
    ticker_upper = ticker.upper()

    posts = (
        db.query(SentimentData)
        .filter(
            SentimentData.tickers_mentioned.contains(ticker_upper),
            SentimentData.ingested_at >= cutoff,
        )
        .all()
    )

    positive = sum(1 for p in posts if p.sentiment == "positive")
    negative = sum(1 for p in posts if p.sentiment == "negative")
    neutral = sum(1 for p in posts if p.sentiment == "neutral")
    confidences = [p.confidence for p in posts if p.confidence is not None]
    avg_conf = sum(confidences) / len(confidences) if confidences else None

    return SentimentSummary(
        ticker=ticker_upper,
        total_mentions=len(posts),
        positive_count=positive,
        negative_count=negative,
        neutral_count=neutral,
        avg_confidence=round(avg_conf, 4) if avg_conf else None,
        avg_upvotes=round(sum(p.upvotes for p in posts) / len(posts), 1) if posts else 0,
        total_comments=sum(p.comments_count for p in posts),
    )


@router.post("/refresh")
def refresh_sentiment_data(
    subreddits: Optional[List[str]] = None,
    limit: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Manually trigger sentiment data scraping."""
    from app.services.scrapers.sentiment_scrapers import RedditScraper

    scraper = RedditScraper()

    if subreddits:
        all_posts = []
        for sub in subreddits:
            posts = scraper.scrape_subreddit_json(sub, limit=limit, db=db)
            all_posts.extend(posts)
    else:
        all_posts = scraper.scrape_all(limit=limit, db=db)

    return {
        "scraped": len(all_posts),
        "sources": list(set(p.source for p in all_posts)),
    }
