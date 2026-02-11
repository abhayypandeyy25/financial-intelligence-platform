from __future__ import annotations

from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler

from app.database import SessionLocal
from app.services.ingestion import ingest_all_feeds
from app.agents.pipeline import process_unprocessed_articles
from app.services.backtest import run_backtest_for_unvalidated
from app.services.ingestion_orchestrator import IngestionOrchestrator

scheduler = BackgroundScheduler()


def _is_market_hours() -> bool:
    """Check if TSX market is currently open (9:30 AM - 4:00 PM ET, Mon-Fri)."""
    now = datetime.utcnow()
    # UTC offset for ET: -5 (EST) or -4 (EDT)
    # Approximate: TSX open 14:30-21:00 UTC (EST) or 13:30-20:00 UTC (EDT)
    weekday = now.weekday()
    if weekday >= 5:  # Saturday or Sunday
        return False
    hour = now.hour
    return 14 <= hour <= 21


def scheduled_ingestion():
    """Periodic job: ingest news from RSS + web scrapers, process through AI, and back-test."""
    print("\n=== Scheduled Ingestion Starting ===")
    db = SessionLocal()
    try:
        # Step 1a: Ingest from RSS feeds
        print("[1/5] Ingesting RSS feeds...")
        rss_results = ingest_all_feeds(db)
        rss_new = sum(rss_results.values())
        print(f"[1/5] Ingested {rss_new} articles from RSS")

        # Step 1b: Ingest from web scrapers
        print("[2/5] Scraping web news sources...")
        orchestrator = IngestionOrchestrator()
        try:
            web_results = orchestrator.ingest_all_news(db, limit_per_source=10)
            web_new = sum(web_results.values())
            print(f"[2/5] Scraped {web_new} articles from web sources")
        except Exception as e:
            print(f"[2/5] Web scraping error (non-fatal): {e}")
            web_new = 0

        total_new = rss_new + web_new

        # Step 2: Process through AI pipeline
        if total_new > 0:
            print("[3/5] Processing through AI pipeline...")
            process_result = process_unprocessed_articles(db, limit=10)
            print(f"[3/5] Processed {process_result['articles_processed']} articles, generated {process_result['signals_generated']} signals")

            # Step 3: Run back-tests
            print("[4/5] Running back-tests...")
            bt_result = run_backtest_for_unvalidated(db)
            print(f"[4/5] Tested {bt_result['signals_tested']} signals, created {bt_result['results_created']} results")
        else:
            print("[3/5] No new articles to process")
            print("[4/5] Skipping back-tests")

        # Step 5: Ingest sentiment data
        print("[5/5] Scraping Reddit sentiment...")
        try:
            sentiment_count = orchestrator.ingest_sentiment(db, limit=25)
            print(f"[5/5] Scraped {sentiment_count} sentiment posts")
        except Exception as e:
            print(f"[5/5] Sentiment scraping error (non-fatal): {e}")

    except Exception as e:
        print(f"Scheduled ingestion error: {e}")
    finally:
        db.close()
    print("=== Scheduled Ingestion Complete ===\n")


def scheduled_stock_quotes():
    """Periodic job: update stock quotes (runs more frequently during market hours)."""
    if not _is_market_hours():
        return

    print("\n=== Stock Quote Update Starting ===")
    db = SessionLocal()
    try:
        orchestrator = IngestionOrchestrator()
        count = orchestrator.update_stock_quotes(db)
        print(f"Updated {count} stock quotes")
    except Exception as e:
        print(f"Stock quote update error: {e}")
    finally:
        db.close()
    print("=== Stock Quote Update Complete ===\n")


def start_scheduler():
    """Start the background scheduler."""
    # News + sentiment ingestion every 30 minutes
    scheduler.add_job(
        scheduled_ingestion,
        "interval",
        minutes=30,
        id="news_ingestion",
        replace_existing=True,
    )

    # Stock quotes every 15 minutes (only runs during market hours)
    scheduler.add_job(
        scheduled_stock_quotes,
        "interval",
        minutes=15,
        id="stock_quotes",
        replace_existing=True,
    )

    scheduler.start()
    print("Scheduler started:")
    print("  - News + sentiment ingestion: every 30 minutes")
    print("  - Stock quotes: every 15 minutes (market hours only)")


def stop_scheduler():
    """Stop the background scheduler."""
    scheduler.shutdown()
