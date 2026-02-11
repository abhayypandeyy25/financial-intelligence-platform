from __future__ import annotations

from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Article, Signal
from app.services.ingestion import ingest_all_feeds

router = APIRouter(prefix="/api/news", tags=["news"])


class ArticleResponse(BaseModel):
    id: int
    title: str
    summary: Optional[str]
    source: str
    url: str
    published_at: Optional[datetime]
    ingested_at: Optional[datetime]
    processed: bool

    model_config = {"from_attributes": True}


class IngestResponse(BaseModel):
    total_new: int
    by_source: dict[str, int]


@router.get("", response_model=List[ArticleResponse])
def list_articles(
    source: Optional[str] = None,
    processed: Optional[bool] = None,
    ticker: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    query = db.query(Article).order_by(Article.published_at.desc())
    if source:
        query = query.filter(Article.source == source)
    if processed is not None:
        query = query.filter(Article.processed == processed)
    if ticker:
        query = query.join(Signal, Signal.article_id == Article.id).filter(
            Signal.stock_ticker == ticker.upper()
        ).distinct()
    return query.offset(skip).limit(limit).all()


@router.get("/sources")
def list_sources(db: Session = Depends(get_db)):
    sources = db.query(Article.source).distinct().all()
    return [s[0] for s in sources]


@router.get("/{article_id}", response_model=ArticleResponse)
def get_article(article_id: int, db: Session = Depends(get_db)):
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Article not found")
    return article


@router.post("/ingest", response_model=IngestResponse)
def trigger_ingestion(db: Session = Depends(get_db)):
    results = ingest_all_feeds(db)
    total = sum(results.values())
    return IngestResponse(total_new=total, by_source=results)
