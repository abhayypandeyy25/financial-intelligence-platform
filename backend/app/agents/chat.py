from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import List, Optional

from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.models import Article, Signal, StockQuote, BacktestResult, SentimentData, Theme, Top100Stock
from app.agents.base import call_claude
from app.config import get_settings

settings = get_settings()

SYSTEM_PROMPT = """You are a financial intelligence assistant specializing in the Canadian market (TSX).
You have access to a live database of:
- Financial news articles from 8+ Canadian sources
- AI-generated investment signals with direction, confidence, and reasoning
- Backtest validation results (1-day, 7-day, 30-day accuracy)
- Community sentiment from Reddit and Twitter
- Real-time stock quotes for 50+ TSX stocks
- Investment themes detected from news patterns

When answering:
1. Be specific — cite actual ticker symbols (e.g., SHOP.TO, RY.TO), signal confidence percentages, and price changes.
2. When referencing signals, include the signal ID like [Signal #42] so the user can click through.
3. When referencing stocks, mention the ticker like SHOP.TO so the user can look it up.
4. Be balanced — mention both bullish and bearish signals when relevant.
5. If data is limited or unavailable, say so honestly.
6. Keep responses concise but informative (2-4 paragraphs max).
7. Include a disclaimer that this is AI-generated analysis, not financial advice.

Format your response in clean markdown. Use **bold** for key numbers and tickers. Use tables for comparisons if helpful."""

INTENT_PROMPT = """Classify the user's intent and extract entities from this financial query.

User query: "{query}"

Return a JSON object with:
- "intent": one of ["signal_lookup", "stock_analysis", "sector_analysis", "comparison", "trend_query", "sentiment_query", "backtest_query", "general"]
- "tickers": list of stock tickers mentioned (e.g., ["SHOP.TO", "RY.TO"]), empty if none
- "sectors": list of sectors mentioned (e.g., ["Energy", "Finance"]), empty if none
- "sentiment_filter": "positive", "negative", "neutral", or null
- "time_range_days": number of days to look back (default 7)

Only return valid JSON, no other text."""


def classify_intent(query: str) -> dict:
    """Classify user intent using Claude (cheap call)."""
    try:
        raw = call_claude(
            "You are a query classifier. Return only valid JSON.",
            INTENT_PROMPT.format(query=query),
            max_tokens=300,
            temperature=0.1,
            model="claude-haiku-4-5-20251001",
        )
        # Parse JSON from response
        import re
        json_match = re.search(r"\{[\s\S]*\}", raw)
        if json_match:
            return json.loads(json_match.group())
    except Exception as e:
        print(f"Intent classification failed: {e}")

    return {
        "intent": "general",
        "tickers": [],
        "sectors": [],
        "sentiment_filter": None,
        "time_range_days": 7,
    }


def build_context(intent: dict, db: Session) -> str:
    """Build context string from database based on classified intent."""
    sections = []
    days = intent.get("time_range_days", 7)
    cutoff = datetime.utcnow() - timedelta(days=days)
    tickers = intent.get("tickers", [])
    sectors = intent.get("sectors", [])
    intent_type = intent.get("intent", "general")

    # Always include recent signal summary
    signal_query = db.query(Signal).filter(Signal.created_at >= cutoff).order_by(desc(Signal.confidence))

    if tickers:
        signal_query = signal_query.filter(Signal.stock_ticker.in_(tickers))
    if sectors:
        signal_query = signal_query.filter(Signal.sector.in_(sectors))
    if intent.get("sentiment_filter"):
        signal_query = signal_query.filter(Signal.sentiment == intent["sentiment_filter"])

    signals = signal_query.limit(15).all()
    if signals:
        signal_lines = []
        for s in signals:
            signal_lines.append(
                f"- [Signal #{s.id}] {s.stock_ticker} | {s.direction or '?'} | "
                f"{s.sentiment} | {s.confidence:.0%} confidence | "
                f"{s.reasoning or 'No reasoning'}"
            )
        sections.append(f"## Recent Signals ({len(signals)})\n" + "\n".join(signal_lines))

    # Stock quotes for relevant tickers
    if intent_type in ("stock_analysis", "comparison", "signal_lookup") or tickers:
        quote_tickers = tickers if tickers else [s.stock_ticker for s in signals[:5]]
        if quote_tickers:
            quotes = (
                db.query(StockQuote)
                .filter(StockQuote.ticker.in_(quote_tickers))
                .order_by(desc(StockQuote.ingested_at))
                .all()
            )
            # Deduplicate to latest per ticker
            seen = set()
            quote_lines = []
            for q in quotes:
                if q.ticker not in seen:
                    seen.add(q.ticker)
                    quote_lines.append(
                        f"- {q.ticker}: ${q.current_price or '?'} "
                        f"({'+' if (q.percent_change or 0) >= 0 else ''}{q.percent_change or 0:.2f}%) "
                        f"Vol: {q.volume or '?'}"
                    )
            if quote_lines:
                sections.append("## Stock Quotes\n" + "\n".join(quote_lines))

    # Sentiment data
    if intent_type in ("sentiment_query", "stock_analysis", "trend_query") or tickers:
        sent_query = db.query(SentimentData).filter(SentimentData.ingested_at >= cutoff)
        if tickers:
            for ticker in tickers:
                sent_query = sent_query.filter(SentimentData.tickers_mentioned.contains(ticker))
        sentiment_posts = sent_query.order_by(desc(SentimentData.posted_at)).limit(10).all()
        if sentiment_posts:
            pos = sum(1 for p in sentiment_posts if p.sentiment == "positive")
            neg = sum(1 for p in sentiment_posts if p.sentiment == "negative")
            sections.append(
                f"## Community Sentiment ({len(sentiment_posts)} posts, {pos} positive, {neg} negative)\n"
                + "\n".join(
                    f"- [{p.source}] {p.content[:150]}... (sentiment: {p.sentiment or 'unprocessed'})"
                    for p in sentiment_posts[:5]
                )
            )

    # Backtest accuracy
    if intent_type in ("backtest_query", "sector_analysis", "general"):
        bt_query = db.query(BacktestResult)
        if tickers:
            bt_query = bt_query.filter(BacktestResult.ticker.in_(tickers))
        backtests = bt_query.limit(20).all()
        if backtests:
            tested = len(backtests)
            acc_1d = sum(1 for b in backtests if b.accurate_1d) / max(1, sum(1 for b in backtests if b.accurate_1d is not None))
            acc_7d = sum(1 for b in backtests if b.accurate_7d) / max(1, sum(1 for b in backtests if b.accurate_7d is not None))
            sections.append(
                f"## Backtest Performance\n"
                f"- {tested} signals tested\n"
                f"- 1-day accuracy: {acc_1d:.0%}\n"
                f"- 7-day accuracy: {acc_7d:.0%}"
            )

    # Active themes
    if intent_type in ("trend_query", "sector_analysis", "general"):
        themes = db.query(Theme).filter(Theme.created_at >= cutoff).order_by(desc(Theme.relevance_score)).limit(5).all()
        if themes:
            sections.append(
                "## Active Themes\n" + "\n".join(
                    f"- {t.name} ({t.sector or 'Cross-sector'}, relevance: {(t.relevance_score or 0):.0%}): {t.description or ''}"
                    for t in themes
                )
            )

    # Sector summary for sector analysis
    if intent_type == "sector_analysis":
        sector_signals = (
            db.query(Signal.sector, func.count(Signal.id), func.avg(Signal.confidence))
            .filter(Signal.created_at >= cutoff)
            .group_by(Signal.sector)
            .all()
        )
        if sector_signals:
            sections.append(
                "## Signals by Sector\n" + "\n".join(
                    f"- {sector or 'Unknown'}: {count} signals, avg confidence {avg:.0%}"
                    for sector, count, avg in sector_signals
                )
            )

    if not sections:
        sections.append("No relevant data found in the database for this query. The database may need fresh data ingestion.")

    return "\n\n".join(sections)


def extract_references(response_text: str) -> list[dict]:
    """Extract ticker and signal references from the response text."""
    import re
    refs = []
    seen = set()

    # Extract signal references like [Signal #42]
    for match in re.finditer(r"\[Signal #(\d+)\]", response_text):
        signal_id = int(match.group(1))
        key = f"signal_{signal_id}"
        if key not in seen:
            refs.append({"type": "signal", "id": signal_id})
            seen.add(key)

    # Extract ticker references
    known_tickers = set(settings.tsx_stocks.keys())
    for ticker in known_tickers:
        if ticker in response_text:
            key = f"stock_{ticker}"
            if key not in seen:
                refs.append({"type": "stock", "ticker": ticker})
                seen.add(key)

    return refs


def generate_suggestions(query: str, intent: dict, db: Session) -> list[str]:
    """Generate follow-up query suggestions based on context."""
    suggestions = []

    tickers = intent.get("tickers", [])
    sectors = intent.get("sectors", [])
    intent_type = intent.get("intent", "general")

    if tickers:
        for t in tickers[:2]:
            suggestions.append(f"What's the backtest accuracy for {t}?")
            suggestions.append(f"Show me community sentiment for {t}")
    elif sectors:
        for s in sectors[:1]:
            suggestions.append(f"Which {s} stocks have the strongest signals?")
    else:
        # Generic suggestions based on recent data
        recent_signal = db.query(Signal).order_by(desc(Signal.created_at)).first()
        if recent_signal:
            suggestions.append(f"Tell me more about {recent_signal.stock_ticker}")

    # Always add some generic ones
    if intent_type != "sector_analysis":
        suggestions.append("Which sector has the best signal accuracy?")
    if intent_type != "trend_query":
        suggestions.append("What are the top investment themes this week?")
    if intent_type != "signal_lookup":
        suggestions.append("What are the strongest bullish signals?")

    return suggestions[:4]


def chat(query: str, conversation_history: list[dict], db: Session) -> dict:
    """Main chat function: classify intent, build context, generate response."""
    # 1. Classify intent
    intent = classify_intent(query)

    # 2. Build context from database
    context = build_context(intent, db)

    # 3. Build messages for Claude (multi-turn)
    messages = []
    for msg in conversation_history[-6:]:  # Last 6 messages for context
        messages.append({"role": msg["role"], "content": msg["content"]})

    # Add current query with context
    user_message = f"""Here is the current data from our financial intelligence database:

{context}

---

User question: {query}"""

    messages.append({"role": "user", "content": user_message})

    # 4. Generate response
    response_text = call_claude(
        SYSTEM_PROMPT,
        "",  # unused when messages is provided
        max_tokens=1500,
        temperature=0.4,
        messages=messages,
    )

    # 5. Extract references
    references = extract_references(response_text)

    # 6. Generate suggestions
    suggestions = generate_suggestions(query, intent, db)

    return {
        "response": response_text,
        "references": references,
        "suggested_queries": suggestions,
    }
