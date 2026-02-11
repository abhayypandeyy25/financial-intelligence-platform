#!/usr/bin/env python3
"""
Seed script for the Financial Intelligence Platform demo.

This script:
1. Ingests articles from RSS feeds
2. Processes them through the AI pipeline
3. Runs back-tests against real market data

Run this before a demo to populate the database with real data.
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import init_db, SessionLocal
from app.services.ingestion import ingest_all_feeds
from app.agents.pipeline import process_unprocessed_articles
from app.services.backtest import run_backtest_for_unvalidated
from app.agents.theme import detect_themes
from app.models import Article, Theme
from datetime import datetime, timedelta


def main():
    print("=" * 60)
    print("Financial Intelligence Platform - Demo Seed Script")
    print("=" * 60)

    # Initialize database
    print("\n[Step 0] Initializing database...")
    init_db()
    db = SessionLocal()

    try:
        # Step 1: Ingest news
        print("\n[Step 1] Ingesting financial news from RSS feeds...")
        results = ingest_all_feeds(db)
        total = sum(results.values())
        print(f"  Total new articles: {total}")
        for source, count in results.items():
            print(f"    {source}: {count}")

        total_articles = db.query(Article).count()
        print(f"\n  Total articles in database: {total_articles}")

        # Step 2: Process through AI pipeline
        print("\n[Step 2] Processing articles through AI pipeline...")
        print("  (This will make API calls to Claude - may take a few minutes)")
        process_result = process_unprocessed_articles(db, limit=15)
        print(f"\n  Articles processed: {process_result['articles_processed']}")
        print(f"  Signals generated: {process_result['signals_generated']}")

        # Step 3: Back-test signals
        print("\n[Step 3] Running back-tests against market data...")
        bt_result = run_backtest_for_unvalidated(db)
        print(f"\n  Signals tested: {bt_result['signals_tested']}")
        print(f"  Results created: {bt_result['results_created']}")

        # Step 4: Detect themes
        print("\n[Step 4] Detecting investment themes...")
        cutoff = datetime.utcnow() - timedelta(days=14)
        articles = db.query(Article).filter(
            Article.processed == True,
            Article.published_at >= cutoff,
        ).order_by(Article.published_at.desc()).limit(30).all()

        if len(articles) >= 2:
            article_dicts = [
                {"title": a.title, "summary": a.summary or a.content, "source": a.source}
                for a in articles
            ]
            raw_themes = detect_themes(article_dicts)
            for t in raw_themes:
                theme = Theme(
                    name=t.get("name", "Unknown"),
                    description=t.get("description", ""),
                    sector=t.get("sector", "Cross-sector"),
                    relevance_score=t.get("relevance_score", 0.5),
                    created_at=datetime.utcnow(),
                )
                indices = t.get("article_indices", [])
                for idx in indices:
                    if 0 <= idx < len(articles):
                        theme.articles.append(articles[idx])
                db.add(theme)
            db.commit()
            print(f"  Themes detected: {len(raw_themes)}")
        else:
            print("  Not enough articles for theme detection")

        # Summary
        from app.models import Signal, BacktestResult
        print("\n" + "=" * 60)
        print("SEED COMPLETE - Database Summary")
        print("=" * 60)
        print(f"  Articles: {db.query(Article).count()}")
        print(f"  Signals: {db.query(Signal).count()}")
        print(f"  Back-test Results: {db.query(BacktestResult).count()}")
        print(f"  Themes: {db.query(Theme).count()}")

        # Accuracy summary
        bt_results = db.query(BacktestResult).all()
        if bt_results:
            acc_1d = [r.accurate_1d for r in bt_results if r.accurate_1d is not None]
            acc_7d = [r.accurate_7d for r in bt_results if r.accurate_7d is not None]
            if acc_1d:
                print(f"\n  1-Day Accuracy: {sum(acc_1d)/len(acc_1d)*100:.1f}%")
            if acc_7d:
                print(f"  7-Day Accuracy: {sum(acc_7d)/len(acc_7d)*100:.1f}%")

        print("\nReady for demo! Start the server with:")
        print("  cd backend && uvicorn app.main:app --reload")
        print("  cd frontend && npm run dev")

    finally:
        db.close()


if __name__ == "__main__":
    main()
