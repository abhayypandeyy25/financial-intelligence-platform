from __future__ import annotations

from app.agents.base import call_claude_json
from app.config import get_settings

settings = get_settings()

SYSTEM_PROMPT = """You are a financial entity extraction agent specializing in the Canadian stock market (TSX).
Your job is to identify companies, stocks, and indexes mentioned in financial news articles and link them to their TSX ticker symbols.

You have access to these TSX-listed companies:
{stock_list}

Rules:
- Only return entities you are confident about (>70% confidence)
- Map company names, abbreviations, and references to the correct ticker
- Include the exchange (always "TSX" for this pilot)
- If the article mentions a sector or industry without specific companies, try to identify the most relevant TSX stocks
- Return an empty array if no TSX-relevant entities are found

Return ONLY valid JSON array."""

USER_PROMPT = """Extract TSX-listed entities from this financial news article:

Title: {title}
Content: {content}

Return a JSON array of objects with these fields:
- ticker: string (TSX ticker symbol, e.g., "RY.TO")
- company_name: string
- exchange: string (always "TSX")
- confidence: number (0.0 to 1.0)
- mention_context: string (brief quote or context from the article)"""


def extract_entities(title: str, content: str) -> list[dict]:
    """Extract stock/company entities from an article."""
    stock_list = "\n".join(f"- {ticker}: {name}" for ticker, name in settings.tsx_stocks.items())

    system = SYSTEM_PROMPT.format(stock_list=stock_list)
    user = USER_PROMPT.format(title=title, content=content)

    try:
        result = call_claude_json(system, user, max_tokens=1500)
        if isinstance(result, list):
            return result
        return []
    except Exception as e:
        print(f"Entity extraction error: {e}")
        return []
