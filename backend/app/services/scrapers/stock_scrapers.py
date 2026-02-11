from __future__ import annotations

import time
from datetime import datetime
from typing import List, Optional

import yfinance as yf
from sqlalchemy.orm import Session

from app.models import StockQuote, Top100Stock
from app.config import get_settings


class YFinanceStockScraper:
    """
    Stock data scraper using yfinance library.
    Uses batch download for efficiency and to avoid rate limits.
    """

    source_name = "Yahoo Finance"

    def fetch_quotes_batch(self, tickers: List[str], db: Optional[Session] = None) -> List[StockQuote]:
        """
        Fetch quotes for multiple tickers using batch download.
        This is far more efficient than individual requests.
        """
        print(f"Fetching stock quotes for {len(tickers)} tickers (batch)...")
        quotes = []
        settings = get_settings()

        try:
            # Batch download latest day data
            data = yf.download(
                tickers=tickers,
                period="2d",
                progress=False,
                threads=True,
            )

            if data.empty:
                print("  No data returned from yfinance")
                return quotes

            for ticker in tickers:
                try:
                    # Extract data for this ticker
                    if len(tickers) == 1:
                        ticker_data = data
                    else:
                        ticker_data = data.xs(ticker, axis=1, level=1) if len(data.columns.names) > 1 else data

                    if ticker_data.empty:
                        continue

                    latest = ticker_data.iloc[-1]
                    previous = ticker_data.iloc[-2] if len(ticker_data) >= 2 else None

                    current_price = float(latest.get("Close", 0))
                    if current_price == 0:
                        continue

                    previous_close = float(previous.get("Close", 0)) if previous is not None else None
                    price_change = None
                    percent_change = None
                    if current_price and previous_close and previous_close > 0:
                        price_change = round(current_price - previous_close, 4)
                        percent_change = round((price_change / previous_close) * 100, 4)

                    company_name = settings.tsx_stocks.get(ticker, ticker)

                    quote = StockQuote(
                        ticker=ticker,
                        company_name=company_name,
                        exchange="TSX",
                        current_price=round(current_price, 2),
                        open_price=round(float(latest.get("Open", 0)), 2) or None,
                        high_price=round(float(latest.get("High", 0)), 2) or None,
                        low_price=round(float(latest.get("Low", 0)), 2) or None,
                        previous_close=round(previous_close, 2) if previous_close else None,
                        volume=int(latest.get("Volume", 0)) or None,
                        price_change=price_change,
                        percent_change=percent_change,
                        source=self.source_name,
                        quote_time=datetime.utcnow(),
                        ingested_at=datetime.utcnow(),
                    )

                    quotes.append(quote)
                    change_str = f" ({percent_change:+.2f}%)" if percent_change else ""
                    print(f"  {ticker}: ${current_price:.2f}{change_str}")

                    if db:
                        db.add(quote)

                except Exception as e:
                    print(f"  Error processing {ticker}: {e}")
                    continue

            if db:
                db.commit()

        except Exception as e:
            print(f"  Batch download error: {e}")

        print(f"Fetched {len(quotes)} quotes out of {len(tickers)} tickers")
        return quotes

    def fetch_quote_single(self, ticker: str) -> Optional[StockQuote]:
        """Fetch a single stock quote (slower, use for individual lookups)."""
        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(period="2d")

            if hist.empty:
                return None

            latest = hist.iloc[-1]
            previous = hist.iloc[-2] if len(hist) >= 2 else None

            current_price = float(latest.get("Close", 0))
            if current_price == 0:
                return None

            previous_close = float(previous.get("Close", 0)) if previous is not None else None
            price_change = None
            percent_change = None
            if current_price and previous_close and previous_close > 0:
                price_change = round(current_price - previous_close, 4)
                percent_change = round((price_change / previous_close) * 100, 4)

            settings = get_settings()

            return StockQuote(
                ticker=ticker,
                company_name=settings.tsx_stocks.get(ticker, ticker),
                exchange="TSX",
                current_price=round(current_price, 2),
                open_price=round(float(latest.get("Open", 0)), 2) or None,
                high_price=round(float(latest.get("High", 0)), 2) or None,
                low_price=round(float(latest.get("Low", 0)), 2) or None,
                previous_close=round(previous_close, 2) if previous_close else None,
                volume=int(latest.get("Volume", 0)) or None,
                price_change=price_change,
                percent_change=percent_change,
                source=self.source_name,
                quote_time=datetime.utcnow(),
                ingested_at=datetime.utcnow(),
            )
        except Exception as e:
            print(f"  Error fetching {ticker}: {e}")
            return None

    def fetch_top_tsx_quotes(self, db: Optional[Session] = None) -> List[StockQuote]:
        """Fetch quotes for all configured TSX stocks."""
        settings = get_settings()
        tickers = list(settings.tsx_stocks.keys())
        return self.fetch_quotes_batch(tickers, db=db)

    def update_top_100_universe(self, db: Session) -> List[Top100Stock]:
        """Update the Top 100 TSX stocks table from configured stock list."""
        print("Updating Top 100 TSX stocks...")
        settings = get_settings()

        results = []
        for rank, (ticker, name) in enumerate(settings.tsx_stocks.items(), 1):
            sector = settings.stock_sectors.get(ticker, "Other")

            existing = db.query(Top100Stock).filter(Top100Stock.ticker == ticker).first()
            if existing:
                existing.market_cap_rank = rank
                existing.last_updated = datetime.utcnow()
                results.append(existing)
            else:
                top_stock = Top100Stock(
                    ticker=ticker,
                    company_name=name,
                    exchange="TSX",
                    sector=sector,
                    market_cap_rank=rank,
                    is_active=True,
                    last_updated=datetime.utcnow(),
                    selection_criteria="market_cap",
                )
                db.add(top_stock)
                results.append(top_stock)

        db.commit()
        print(f"Updated {len(results)} stocks in Top 100 universe")
        return results
