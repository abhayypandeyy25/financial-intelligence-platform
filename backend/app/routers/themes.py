from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Article, Theme, theme_articles
from app.agents.theme import detect_themes
from app.config import get_settings

router = APIRouter(prefix="/api/themes", tags=["themes"])
settings = get_settings()


class ThemeResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    sector: Optional[str]
    relevance_score: Optional[float]
    created_at: Optional[datetime]
    article_count: int = 0

    model_config = {"from_attributes": True}


class OntologyResponse(BaseModel):
    sectors: List[str]
    geographies: List[str]
    exchanges: List[str]
    asset_classes: List[str]
    insight_types: List[str]


class DetectThemesResponse(BaseModel):
    themes_detected: int


@router.get("", response_model=List[ThemeResponse])
def list_themes(
    days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
):
    cutoff = datetime.utcnow() - timedelta(days=days)
    themes = db.query(Theme).filter(Theme.created_at >= cutoff).order_by(Theme.relevance_score.desc()).all()
    results = []
    for t in themes:
        r = ThemeResponse.model_validate(t)
        r.article_count = len(t.articles)
        results.append(r)
    return results


@router.get("/ontology", response_model=OntologyResponse)
def get_ontology():
    return OntologyResponse(
        sectors=settings.sectors,
        geographies=settings.geographies,
        exchanges=settings.exchanges,
        asset_classes=settings.asset_classes,
        insight_types=settings.insight_types,
    )


@router.post("/detect", response_model=DetectThemesResponse)
def trigger_theme_detection(
    days: int = Query(7, ge=1, le=30),
    db: Session = Depends(get_db),
):
    """Detect themes from recent articles."""
    cutoff = datetime.utcnow() - timedelta(days=days)
    articles = db.query(Article).filter(
        Article.published_at >= cutoff,
        Article.processed == True,
    ).order_by(Article.published_at.desc()).limit(50).all()

    if len(articles) < 2:
        return DetectThemesResponse(themes_detected=0)

    article_dicts = [
        {"title": a.title, "summary": a.summary or a.content, "source": a.source}
        for a in articles
    ]

    raw_themes = detect_themes(article_dicts)

    themes_created = 0
    for t in raw_themes:
        theme = Theme(
            name=t.get("name", "Unknown Theme"),
            description=t.get("description", ""),
            sector=t.get("sector", "Cross-sector"),
            relevance_score=t.get("relevance_score", 0.5),
            created_at=datetime.utcnow(),
        )
        # Link articles
        article_indices = t.get("article_indices", [])
        for idx in article_indices:
            if 0 <= idx < len(articles):
                theme.articles.append(articles[idx])

        db.add(theme)
        themes_created += 1

    db.commit()
    return DetectThemesResponse(themes_detected=themes_created)
