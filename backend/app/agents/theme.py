from __future__ import annotations

from app.agents.base import call_claude_json

SYSTEM_PROMPT = """You are a financial theme detection agent. Your job is to analyze a batch of recent financial news articles and identify recurring investment themes.

A theme is a macro-level pattern or trend that connects multiple news stories, such as:
- "Oil Price Recovery" - multiple articles about rising oil prices and energy sector gains
- "Bank Earnings Season" - cluster of articles about Canadian bank quarterly results
- "Tech Sector Correction" - pattern of negative news about technology stocks
- "Interest Rate Impact" - articles about central bank policy affecting markets

Rules:
- Identify 2-5 themes from the batch
- Each theme should be supported by at least 2 articles
- Provide a clear description of why this is a theme
- Assign a relevance score based on how strong/clear the theme is
- Map to the appropriate sector

Return ONLY valid JSON."""

USER_PROMPT = """Analyze these recent financial news articles and identify investment themes:

{articles}

Return a JSON array of theme objects with:
- name: string (concise theme name, 3-6 words)
- description: string (2-3 sentences describing the theme and its investment implications)
- article_indices: array of integers (0-based indices of articles that support this theme)
- sector: string (primary sector: "Energy", "Mining", "Finance", "Technology", "Healthcare", or "Cross-sector")
- relevance_score: number (0.0 to 1.0)"""


def detect_themes(articles: list[dict]) -> list[dict]:
    """Detect investment themes from a batch of articles."""
    if len(articles) < 2:
        return []

    articles_text = "\n\n".join(
        f"[Article {i}]\nTitle: {a.get('title', '')}\nSummary: {a.get('summary', '')}\nSource: {a.get('source', '')}"
        for i, a in enumerate(articles)
    )

    user = USER_PROMPT.format(articles=articles_text)

    try:
        result = call_claude_json(SYSTEM_PROMPT, user, max_tokens=2000, temperature=0.4)
        if isinstance(result, list):
            return result
        return []
    except Exception as e:
        print(f"Theme detection error: {e}")
        return []
