from __future__ import annotations

from app.agents.base import call_claude_json

SYSTEM_PROMPT = """You are a financial signal generation agent. Your job is to produce actionable investment signals from analyzed financial news.

A signal tells an investor:
1. Which stock/ticker is affected
2. Which direction (up or down) the stock is likely to move
3. How confident we are in this prediction
4. Why - the impact hypothesis explaining the causal chain
5. Time horizon - when the impact is expected

Be conservative with confidence scores. Only assign >0.7 confidence for very clear signals.

Return ONLY valid JSON."""

USER_PROMPT = """Generate an investment signal from this analyzed article:

Title: {title}
Content: {content}

Entities: {entities}
Sentiment: {sentiment} (confidence: {sentiment_confidence})
Sentiment Reasoning: {reasoning}

For each entity with sufficient signal strength, return a JSON array of signal objects with:
- ticker: string (TSX ticker)
- company_name: string
- direction: string ("up" or "down")
- confidence: number (0.0 to 1.0)
- impact_hypothesis: string (2-3 sentences explaining the expected market impact and why)
- time_horizon: string ("short" for 1-3 days, "medium" for 1-4 weeks, "long" for 1-3 months)
- sector: string (one of: "Energy", "Mining", "Finance", "Technology", "Healthcare")

Return an empty array if no actionable signal can be generated."""


def generate_signals(
    title: str,
    content: str,
    entities: list[dict],
    sentiment: dict,
) -> list[dict]:
    """Generate investment signals from analyzed article data."""
    entities_str = ", ".join(
        f"{e.get('company_name', '')} ({e.get('ticker', '')})" for e in entities
    ) if entities else "General market"

    user = USER_PROMPT.format(
        title=title,
        content=content,
        entities=entities_str,
        sentiment=sentiment.get("sentiment", "neutral"),
        sentiment_confidence=sentiment.get("confidence", 0.5),
        reasoning=sentiment.get("reasoning", ""),
    )

    try:
        result = call_claude_json(SYSTEM_PROMPT, user, max_tokens=2000)
        if isinstance(result, list):
            return result
        if isinstance(result, dict):
            return [result]
        return []
    except Exception as e:
        print(f"Signal generation error: {e}")
        return []
