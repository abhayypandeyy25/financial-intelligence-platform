from __future__ import annotations

import traceback
from datetime import datetime
from typing import List, Optional

import yfinance as yf
from sqlalchemy.orm import Session

from app.models import StockQuote, Top100Stock
from app.config import get_settings


class YFinanceStockScraper:
    """
    Stock data scraper using yfinance library.
    Fetches individual ticker data for reliability across yfinance versions.
    """

    source_name = "Yahoo Finance"

    def _build_quote(self, ticker: str, latest, previous, settings) -> Optional[StockQuote]:
        """Build a StockQuote from pandas row data."""
        try:
            current_price = float(latest.get("Close", 0))
            if current_price == 0:
                return None

            previous_close = float(previous.get("Close", 0)) if previous is not None else None
            price_change = None
            percent_change = None
            if current_price and previous_close and previous_close > 0:
                price_change = round(current_price - previous_close, 4)
                percent_change = round((price_change / previous_close) * 100, 4)

            company_name = settings.tsx_stocks.get(ticker, ticker)

            return StockQuote(
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
        except Exception as e:
            print(f"  Error building quote for {ticker}: {e}")
            return None

    def fetch_quotes_batch(self, tickers: List[str], db: Optional[Session] = None) -> List[StockQuote]:
        """
        Fetch quotes for multiple tickers.
        Uses individual Ticker.history() calls for reliability.
        """
        print(f"Fetching stock quotes for {len(tickers)} tickers...")
        quotes = []
        settings = get_settings()
        errors = []

        for ticker in tickers:
            try:
                stock = yf.Ticker(ticker)
                hist = stock.history(period="5d")

                if hist.empty:
                    continue

                latest = hist.iloc[-1]
                previous = hist.iloc[-2] if len(hist) >= 2 else None

                quote = self._build_quote(ticker, latest, previous, settings)
                if quote:
                    quotes.append(quote)
                    change_str = f" ({quote.percent_change:+.2f}%)" if quote.percent_change else ""
                    print(f"  {ticker}: ${quote.current_price:.2f}{change_str}")

                    if db:
                        db.add(quote)

            except Exception as e:
                errors.append(f"{ticker}: {e}")
                continue

        if db and quotes:
            try:
                db.commit()
            except Exception as e:
                print(f"  DB commit error: {e}")
                db.rollback()

        if errors:
            print(f"  Errors for {len(errors)} tickers: {'; '.join(errors[:5])}")

        print(f"Fetched {len(quotes)} quotes out of {len(tickers)} tickers")
        return quotes

    def fetch_quote_single(self, ticker: str) -> Optional[StockQuote]:
        """Fetch a single stock quote."""
        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(period="5d")

            if hist.empty:
                print(f"  No history for {ticker}")
                return None

            latest = hist.iloc[-1]
            previous = hist.iloc[-2] if len(hist) >= 2 else None

            settings = get_settings()
            return self._build_quote(ticker, latest, previous, settings)
        except Exception as e:
            print(f"  Error fetching {ticker}: {e}")
            traceback.print_exc()
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
