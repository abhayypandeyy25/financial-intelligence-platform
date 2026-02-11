from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.models import Article, Signal
from app.agents.entity import extract_entities
from app.agents.sentiment import analyze_sentiment
from app.agents.signal import generate_signals
from app.config import get_settings

settings = get_settings()


def process_article(article: Article, db: Session) -> list[Signal]:
    """Process a single article through the full AI pipeline."""
    content = article.summary or article.content or article.title

    # Step 1: Entity extraction
    print(f"  [Entity] Processing: {article.title[:60]}...")
    entities = extract_entities(article.title, content)
    print(f"  [Entity] Found {len(entities)} entities")

    if not entities:
        # Mark as processed even if no entities found
        article.processed = True
        db.commit()
        return []

    # Step 2: Sentiment analysis
    print(f"  [Sentiment] Analyzing...")
    sentiment = analyze_sentiment(article.title, content, entities)
    print(f"  [Sentiment] Result: {sentiment.get('sentiment')} ({sentiment.get('confidence')})")

    # Step 3: Signal generation
    print(f"  [Signal] Generating signals...")
    raw_signals = generate_signals(article.title, content, entities, sentiment)
    print(f"  [Signal] Generated {len(raw_signals)} signals")

    # Store signals in database
    db_signals = []
    for sig in raw_signals:
        ticker = sig.get("ticker", "")
        signal = Signal(
            article_id=article.id,
            stock_ticker=ticker,
            stock_name=sig.get("company_name", settings.tsx_stocks.get(ticker, "")),
            sector=sig.get("sector", settings.stock_sectors.get(ticker, "")),
            sentiment=sentiment.get("sentiment", "neutral"),
            confidence=sig.get("confidence", 0.5),
            reasoning=sentiment.get("reasoning", ""),
            direction=sig.get("direction", ""),
            impact_hypothesis=sig.get("impact_hypothesis", ""),
            time_horizon=sig.get("time_horizon", "medium"),
            insight_type=sentiment.get("insight_type", "Sentiment"),
            created_at=datetime.utcnow(),
        )
        db.add(signal)
        db_signals.append(signal)

    article.processed = True
    db.commit()
    return db_signals


def process_unprocessed_articles(db: Session, limit: int = 20) -> dict:
    """Process all unprocessed articles through the AI pipeline."""
    articles = db.query(Article).filter(
        Article.processed == False
    ).order_by(Article.published_at.desc()).limit(limit).all()

    total_signals = 0
    for i, article in enumerate(articles):
        print(f"\n[{i+1}/{len(articles)}] Processing article: {article.title[:80]}")
        try:
            signals = process_article(article, db)
            total_signals += len(signals)
        except Exception as e:
            print(f"  [Error] Failed to process article {article.id}: {e}")
            article.processed = True  # Skip on error
            db.commit()

    return {"articles_processed": len(articles), "signals_generated": total_signals}
