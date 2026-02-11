from __future__ import annotations

from app.agents.base import call_claude_json

SYSTEM_PROMPT = """You are a financial sentiment analysis agent. Your job is to analyze financial news articles and determine their sentiment impact on specific stocks or the broader market.

Key requirements:
- Determine if the news is POSITIVE, NEGATIVE, or NEUTRAL for the identified entities
- Provide a clear "why" explanation - this is the most important part
- Assign a confidence score based on how clear the sentiment signal is
- Consider both direct and indirect impacts

Return ONLY valid JSON."""

USER_PROMPT = """Analyze the sentiment of this financial news article for the identified entities:

Title: {title}
Content: {content}

Entities identified: {entities}

Return a JSON object with these fields:
- sentiment: string ("positive", "negative", or "neutral")
- confidence: number (0.0 to 1.0)
- reasoning: string (2-3 sentences explaining WHY this sentiment, referencing specific details from the article)
- market_impact: string ("high", "medium", "low")
- insight_type: string (one of: "Event-driven", "Sentiment", "Policy", "Earnings")"""


def analyze_sentiment(title: str, content: str, entities: list[dict]) -> dict:
    """Analyze sentiment of an article given its extracted entities."""
    entities_str = ", ".join(
        f"{e.get('company_name', '')} ({e.get('ticker', '')})" for e in entities
    ) if entities else "General market"

    user = USER_PROMPT.format(title=title, content=content, entities=entities_str)

    try:
        result = call_claude_json(SYSTEM_PROMPT, user, max_tokens=1000)
        if isinstance(result, dict):
            return result
        return {"sentiment": "neutral", "confidence": 0.5, "reasoning": "Unable to determine sentiment"}
    except Exception as e:
        print(f"Sentiment analysis error: {e}")
        return {"sentiment": "neutral", "confidence": 0.5, "reasoning": f"Error: {e}"}
