"""AI market narrative generator.

Uses Claude Haiku (cheap) to produce a 3-4 sentence market briefing
summarizing today's signals, themes, and sentiment.
Cached in-memory for 15 minutes to avoid redundant API calls.
"""
from __future__ import annotations

import time
from datetime import datetime, timedelta

from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.models import Signal, Theme, SentimentData, StockQuote
from app.agents.base import call_claude

# Simple in-memory cache
_cache: dict[str, tuple[str, float]] = {}
CACHE_TTL = 900  # 15 minutes


def _get_cached(key: str) -> str | None:
    if key in _cache:
        text, ts = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return text
        del _cache[key]
    return None


def _set_cached(key: str, value: str) -> None:
    _cache[key] = (value, time.time())


NARRATIVE_SYSTEM = """You are a financial news anchor providing a brief Canadian market update.
Write 3-4 sentences summarizing the key market signals, themes, and sentiment.
Be concise, specific, and professional. Mention tickers and sectors where relevant.
Do not use bullet points — write in paragraph form."""


def generate_narrative(db: Session) -> str:
    """Generate an AI market narrative from current data."""
    cached = _get_cached("narrative")
    if cached:
        return cached

    # Gather context
    cutoff = datetime.utcnow() - timedelta(days=2)

    # Recent signals
    signals = (
        db.query(Signal)
        .filter(Signal.created_at >= cutoff)
        .order_by(desc(Signal.confidence))
        .limit(10)
        .all()
    )

    # Sector signal distribution
    sector_counts = (
        db.query(Signal.sector, func.count(Signal.id))
        .filter(Signal.created_at >= cutoff, Signal.sector.isnot(None))
        .group_by(Signal.sector)
        .all()
    )

    # Sentiment breakdown
    sentiment_counts = (
        db.query(Signal.sentiment, func.count(Signal.id))
        .filter(Signal.created_at >= cutoff)
        .group_by(Signal.sentiment)
        .all()
    )

    # Active themes
    themes = (
        db.query(Theme)
        .filter(Theme.created_at >= cutoff)
        .order_by(desc(Theme.relevance_score))
        .limit(3)
        .all()
    )

    # Top movers
    movers = (
        db.query(StockQuote)
        .filter(StockQuote.percent_change.isnot(None))
        .order_by(desc(func.abs(StockQuote.percent_change)))
        .limit(5)
        .all()
    )

    # Build prompt
    context_parts = []

    if signals:
        bullish = sum(1 for s in signals if s.direction == "up")
        bearish = sum(1 for s in signals if s.direction == "down")
        top = signals[0]
        context_parts.append(
            f"Recent signals: {len(signals)} total ({bullish} bullish, {bearish} bearish). "
            f"Top signal: {top.stock_ticker} {top.direction} with {top.confidence:.0%} confidence."
        )

    if sector_counts:
        sector_str = ", ".join(f"{s}: {c}" for s, c in sector_counts if s)
        context_parts.append(f"Signals by sector: {sector_str}.")

    if sentiment_counts:
        sent_str = ", ".join(f"{s}: {c}" for s, c in sentiment_counts)
        context_parts.append(f"Sentiment breakdown: {sent_str}.")

    if themes:
        theme_str = ", ".join(f'"{t.name}" ({t.sector or "cross-sector"})' for t in themes)
        context_parts.append(f"Active themes: {theme_str}.")

    if movers:
        mover_str = ", ".join(
            f"{m.ticker} ({'+' if (m.percent_change or 0) >= 0 else ''}{m.percent_change:.1f}%)"
            for m in movers[:3]
        )
        context_parts.append(f"Top movers: {mover_str}.")

    if not context_parts:
        return "Market data is still being gathered. Check back shortly for an AI-generated market briefing."

    prompt = (
        "Based on the following Canadian market (TSX) data, write a brief market update:\n\n"
        + "\n".join(context_parts)
    )

    try:
        narrative = call_claude(
            NARRATIVE_SYSTEM,
            prompt,
            max_tokens=300,
            temperature=0.5,
            model="claude-haiku-4-5-20251001",
        )
        _set_cached("narrative", narrative)
        return narrative
    except Exception as e:
        print(f"Narrative generation failed: {e}")
        return "Unable to generate market narrative at this time. Please try again later."
