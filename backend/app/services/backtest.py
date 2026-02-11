from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, Optional

import yfinance as yf
from sqlalchemy.orm import Session

from app.models import Signal, BacktestResult


def get_stock_prices(ticker: str, start_date: datetime, end_date: datetime) -> Dict[str, float]:
    """Fetch historical stock prices for a ticker using yfinance."""
    try:
        stock = yf.Ticker(ticker)
        hist = stock.history(
            start=start_date.strftime("%Y-%m-%d"),
            end=end_date.strftime("%Y-%m-%d"),
        )
        if hist.empty:
            return {}
        # Return date -> close price mapping
        return {d.strftime("%Y-%m-%d"): float(row["Close"]) for d, row in hist.iterrows()}
    except Exception as e:
        print(f"Error fetching prices for {ticker}: {e}")
        return {}


def find_nearest_price(prices: Dict[str, float], target_date: datetime, max_days_offset: int = 5) -> Optional[float]:
    """Find the closest available price to a target date (handles weekends/holidays)."""
    for offset in range(max_days_offset + 1):
        for direction in [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5]:
            check_date = (target_date + timedelta(days=direction + offset)).strftime("%Y-%m-%d")
            if check_date in prices:
                return prices[check_date]
        check_date = (target_date + timedelta(days=offset)).strftime("%Y-%m-%d")
        if check_date in prices:
            return prices[check_date]
    return None


def backtest_signal(signal: Signal, db: Session) -> Optional[BacktestResult]:
    """Back-test a single signal against actual market data."""
    signal_date = signal.created_at or datetime.utcnow()
    ticker = signal.stock_ticker

    if not ticker or not signal.direction:
        return None

    # Fetch prices from signal date to 35 days later
    start = signal_date - timedelta(days=5)
    end = signal_date + timedelta(days=35)
    prices = get_stock_prices(ticker, start, end)

    if not prices:
        print(f"  No price data for {ticker}")
        return None

    # Get prices at signal date, +1d, +7d, +30d
    price_at_signal = find_nearest_price(prices, signal_date)
    price_1d = find_nearest_price(prices, signal_date + timedelta(days=1))
    price_7d = find_nearest_price(prices, signal_date + timedelta(days=7))
    price_30d = find_nearest_price(prices, signal_date + timedelta(days=30))

    if price_at_signal is None:
        return None

    # Calculate changes
    change_1d = ((price_1d - price_at_signal) / price_at_signal * 100) if price_1d else None
    change_7d = ((price_7d - price_at_signal) / price_at_signal * 100) if price_7d else None
    change_30d = ((price_30d - price_at_signal) / price_at_signal * 100) if price_30d else None

    # Determine accuracy (did the stock move in the predicted direction?)
    predicted_up = signal.direction.lower() == "up"
    accurate_1d = (change_1d > 0) == predicted_up if change_1d is not None else None
    accurate_7d = (change_7d > 0) == predicted_up if change_7d is not None else None
    accurate_30d = (change_30d > 0) == predicted_up if change_30d is not None else None

    result = BacktestResult(
        signal_id=signal.id,
        ticker=ticker,
        signal_date=signal_date,
        direction_predicted=signal.direction,
        price_at_signal=round(price_at_signal, 2),
        price_1d=round(price_1d, 2) if price_1d else None,
        price_7d=round(price_7d, 2) if price_7d else None,
        price_30d=round(price_30d, 2) if price_30d else None,
        actual_1d_change=round(change_1d, 2) if change_1d is not None else None,
        actual_7d_change=round(change_7d, 2) if change_7d is not None else None,
        actual_30d_change=round(change_30d, 2) if change_30d is not None else None,
        accurate_1d=accurate_1d,
        accurate_7d=accurate_7d,
        accurate_30d=accurate_30d,
    )
    db.add(result)
    db.commit()
    return result


def run_backtest_for_unvalidated(db: Session) -> dict:
    """Run back-tests for all signals that haven't been validated yet."""
    # Find signals without backtest results
    tested_signal_ids = [r[0] for r in db.query(BacktestResult.signal_id).all()]
    untested = db.query(Signal).filter(
        Signal.id.notin_(tested_signal_ids) if tested_signal_ids else True,
        Signal.direction.isnot(None),
    ).all()

    results_created = 0
    for i, signal in enumerate(untested):
        print(f"  [{i+1}/{len(untested)}] Back-testing {signal.stock_ticker} (signal {signal.id})...")
        try:
            result = backtest_signal(signal, db)
            if result:
                results_created += 1
                acc_str = f"1d:{result.accurate_1d}, 7d:{result.accurate_7d}, 30d:{result.accurate_30d}"
                print(f"    Result: {acc_str}")
        except Exception as e:
            print(f"    Error: {e}")

    return {"signals_tested": len(untested), "results_created": results_created}
