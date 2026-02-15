from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.config import get_settings
from app.models import Article, SentimentData

router = APIRouter(prefix="/api/sources", tags=["sources"])


@router.get("/status")
def get_sources_status(db: Session = Depends(get_db)):
    """Return all configured sources with live statistics from the database."""
    settings = get_settings()
    sources = []

    # News scrapers
    for name, url in settings.news_sources.items():
        count = (
            db.query(func.count(Article.id))
            .filter(Article.source == name)
            .scalar()
            or 0
        )
        last = (
            db.query(func.max(Article.ingested_at))
            .filter(Article.source == name)
            .scalar()
        )
        sources.append(
            {
                "name": name,
                "type": "news_scraper",
                "url": url,
                "is_active": True,
                "last_scrape_time": last.isoformat() if last else None,
                "article_count": count,
                "error_message": None,
            }
        )

    # RSS feeds
    for name, url in settings.rss_feeds.items():
        count = (
            db.query(func.count(Article.id))
            .filter(Article.source == name)
            .scalar()
            or 0
        )
        last = (
            db.query(func.max(Article.ingested_at))
            .filter(Article.source == name)
            .scalar()
        )
        sources.append(
            {
                "name": name,
                "type": "rss_feed",
                "url": url,
                "is_active": True,
                "last_scrape_time": last.isoformat() if last else None,
                "article_count": count,
                "error_message": None,
            }
        )

    # Reddit sources
    for name, url in settings.sentiment_sources.items():
        # Count by matching source name
        source_key = name.lower().replace(" ", "_")
        count = (
            db.query(func.count(SentimentData.id))
            .filter(SentimentData.source.ilike(f"%reddit%"))
            .scalar()
            or 0
        )
        last = (
            db.query(func.max(SentimentData.ingested_at))
            .filter(SentimentData.source.ilike(f"%reddit%"))
            .scalar()
        )
        sources.append(
            {
                "name": name,
                "type": "reddit",
                "url": url,
                "is_active": bool(settings.reddit_client_id),
                "last_scrape_time": last.isoformat() if last else None,
                "article_count": count,
                "error_message": (
                    None
                    if settings.reddit_client_id
                    else "No API credentials configured"
                ),
            }
        )

    # Twitter
    twitter_count = (
        db.query(func.count(SentimentData.id))
        .filter(SentimentData.source.ilike(f"%twitter%"))
        .scalar()
        or 0
    )
    twitter_last = (
        db.query(func.max(SentimentData.ingested_at))
        .filter(SentimentData.source.ilike(f"%twitter%"))
        .scalar()
    )
    sources.append(
        {
            "name": "Twitter / X",
            "type": "twitter",
            "url": "https://twitter.com",
            "is_active": bool(settings.twitter_bearer_token),
            "last_scrape_time": (
                twitter_last.isoformat() if twitter_last else None
            ),
            "article_count": twitter_count,
            "accounts_tracked": settings.twitter_accounts,
            "error_message": (
                None
                if settings.twitter_bearer_token
                else "No bearer token configured"
            ),
        }
    )

    # Stock data sources
    for name, url in settings.stock_data_sources.items():
        sources.append(
            {
                "name": name,
                "type": "stock_data",
                "url": url,
                "is_active": True,
                "last_scrape_time": None,
                "article_count": 0,
                "error_message": None,
            }
        )

    return sources
