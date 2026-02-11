from __future__ import annotations

from datetime import datetime
from typing import List, Dict

from sqlalchemy.orm import Session

from app.models import Article, StockQuote, SentimentData
from app.services.scrapers.news_scrapers import (
    GlobeAndMailScraper,
    BNNBloombergScraper,
    CBCNewsScraper,
    TMXNewsScraper,
    InvestmentExecutiveScraper,
    GlobalNewsScraper,
    FinancialPostScraper,
    YahooFinanceCanadaScraper,
)
from app.services.scrapers.stock_scrapers import YFinanceStockScraper
from app.services.scrapers.sentiment_scrapers import RedditScraper, TwitterScraper


class IngestionOrchestrator:
    """
    Unified orchestrator for all data ingestion:
    - News articles from 8+ web sources
    - Stock quotes from Yahoo Finance
    - Community sentiment from Reddit
    """

    def __init__(self):
        self.news_scrapers = [
            GlobeAndMailScraper(),
            BNNBloombergScraper(),
            CBCNewsScraper(),
            TMXNewsScraper(),
            InvestmentExecutiveScraper(),
            GlobalNewsScraper(),
            FinancialPostScraper(),
            YahooFinanceCanadaScraper(),
        ]
        self.stock_scraper = YFinanceStockScraper()
        self.sentiment_scraper = RedditScraper()
        self.twitter_scraper = TwitterScraper()

    def ingest_all_news(self, db: Session, limit_per_source: int = 20) -> Dict[str, int]:
        """Scrape all news sources and save to database."""
        print(f"\n{'='*60}")
        print(f"NEWS INGESTION - {datetime.utcnow().isoformat()}")
        print(f"{'='*60}\n")

        results = {}
        total_articles = 0

        for scraper in self.news_scrapers:
            try:
                articles = scraper.scrape(limit=limit_per_source, db=db)

                # Save to database
                for article in articles:
                    try:
                        db.add(article)
                        db.commit()
                        total_articles += 1
                    except Exception:
                        db.rollback()  # Skip duplicates

                results[scraper.source_name] = len(articles)
            except Exception as e:
                print(f"Error with {scraper.source_name}: {e}")
                results[scraper.source_name] = 0
                db.rollback()

        print(f"\nNews ingestion complete: {total_articles} new articles from {len(results)} sources")
        return results

    def update_stock_quotes(self, db: Session, tickers: List[str] = None) -> int:
        """Update stock quotes for given tickers or all TSX stocks."""
        print(f"\n{'='*60}")
        print(f"STOCK QUOTE UPDATE - {datetime.utcnow().isoformat()}")
        print(f"{'='*60}\n")

        if tickers:
            quotes = self.stock_scraper.fetch_quotes_batch(tickers, db=db)
        else:
            quotes = self.stock_scraper.fetch_top_tsx_quotes(db=db)

        print(f"Stock update complete: {len(quotes)} quotes updated")
        return len(quotes)

    def ingest_sentiment(self, db: Session, limit: int = 25) -> int:
        """Scrape Reddit and Twitter sentiment data."""
        print(f"\n{'='*60}")
        print(f"SENTIMENT INGESTION - {datetime.utcnow().isoformat()}")
        print(f"{'='*60}\n")

        # Reddit
        reddit_posts = self.sentiment_scraper.scrape_all(limit=limit, db=db)

        # Twitter/X
        twitter_posts = self.twitter_scraper.scrape_all(limit=limit, db=db)

        total = len(reddit_posts) + len(twitter_posts)
        print(f"Sentiment ingestion complete: {total} posts "
              f"({len(reddit_posts)} Reddit, {len(twitter_posts)} Twitter)")
        return total

    def run_full_ingestion(self, db: Session) -> Dict[str, any]:
        """Run complete data ingestion pipeline."""
        print(f"\n{'#'*60}")
        print(f"FULL INGESTION PIPELINE - {datetime.utcnow().isoformat()}")
        print(f"{'#'*60}\n")

        results = {}

        # 1. News ingestion
        news_results = self.ingest_all_news(db, limit_per_source=10)
        results["news"] = news_results

        # 2. Stock quotes
        quote_count = self.update_stock_quotes(db)
        results["stock_quotes"] = quote_count

        # 3. Sentiment
        sentiment_count = self.ingest_sentiment(db, limit=25)
        results["sentiment_posts"] = sentiment_count

        # Summary
        total_news = sum(news_results.values())
        print(f"\n{'#'*60}")
        print(f"PIPELINE COMPLETE")
        print(f"  News articles: {total_news}")
        print(f"  Stock quotes: {quote_count}")
        print(f"  Sentiment posts: {sentiment_count}")
        print(f"{'#'*60}\n")

        return results
