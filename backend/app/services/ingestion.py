from __future__ import annotations

import hashlib
from datetime import datetime
from time import mktime

import feedparser
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Article

settings = get_settings()


def hash_url(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()


def parse_published_date(entry) -> datetime | None:
    if hasattr(entry, "published_parsed") and entry.published_parsed:
        return datetime.fromtimestamp(mktime(entry.published_parsed))
    if hasattr(entry, "updated_parsed") and entry.updated_parsed:
        return datetime.fromtimestamp(mktime(entry.updated_parsed))
    return None


def ingest_feed(source_name: str, feed_url: str, db: Session) -> list[Article]:
    """Fetch and store articles from a single RSS feed."""
    new_articles = []
    try:
        feed = feedparser.parse(feed_url)
        for entry in feed.entries:
            url = entry.get("link", "")
            if not url:
                continue

            url_h = hash_url(url)
            existing = db.query(Article).filter(Article.url_hash == url_h).first()
            if existing:
                continue

            title = entry.get("title", "").strip()
            summary = entry.get("summary", entry.get("description", "")).strip()
            # Remove HTML tags from summary
            import re
            summary = re.sub(r"<[^>]+>", "", summary).strip()

            article = Article(
                title=title,
                content=summary,
                summary=summary[:500] if summary else title,
                source=source_name,
                url=url,
                url_hash=url_h,
                published_at=parse_published_date(entry),
                ingested_at=datetime.utcnow(),
                processed=False,
            )
            db.add(article)
            new_articles.append(article)

        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error ingesting {source_name}: {e}")

    return new_articles


def ingest_all_feeds(db: Session) -> dict:
    """Ingest from all configured RSS feeds."""
    results = {}
    for source_name, feed_url in settings.rss_feeds.items():
        articles = ingest_feed(source_name, feed_url, db)
        results[source_name] = len(articles)
        print(f"Ingested {len(articles)} new articles from {source_name}")
    return results
