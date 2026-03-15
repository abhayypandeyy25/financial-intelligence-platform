"""Converts financial platform data into MiroFish-compatible formats."""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import TYPE_CHECKING

from app.config import get_settings

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

settings = get_settings()

# Pre-built financial ontology matching MiroFish's 10-entity-type limit
FINANCIAL_ONTOLOGY = {
    "entity_types": [
        {
            "name": "Stock",
            "description": "A publicly traded equity on the TSX exchange",
            "attributes": [
                {"name": "ticker", "type": "text", "description": "TSX ticker symbol"},
                {"name": "sector", "type": "text", "description": "Industry sector"},
                {"name": "market_cap", "type": "text", "description": "Market capitalization category"},
            ],
            "examples": ["RY.TO", "SHOP.TO", "ENB.TO"],
        },
        {
            "name": "Sector",
            "description": "An industry sector grouping multiple stocks",
            "attributes": [
                {"name": "sector_name", "type": "text", "description": "Name of the sector"},
            ],
            "examples": ["Energy", "Finance", "Technology", "Mining", "Healthcare"],
        },
        {
            "name": "Analyst",
            "description": "A financial analyst or research firm that publishes investment opinions",
            "attributes": [
                {"name": "firm", "type": "text", "description": "Employing institution"},
                {"name": "specialty", "type": "text", "description": "Area of coverage"},
            ],
            "examples": ["RBC Capital Markets analyst", "TD Securities strategist"],
        },
        {
            "name": "RetailInvestor",
            "description": "An individual retail investor or trader with personal capital",
            "attributes": [
                {"name": "risk_profile", "type": "text", "description": "Risk tolerance level"},
                {"name": "investment_style", "type": "text", "description": "Value, growth, momentum, etc."},
            ],
            "examples": ["Day trader", "Long-term value investor", "Dividend investor"],
        },
        {
            "name": "InstitutionalInvestor",
            "description": "A large financial institution managing pooled capital",
            "attributes": [
                {"name": "institution_type", "type": "text", "description": "Pension, mutual fund, hedge fund, etc."},
                {"name": "aum", "type": "text", "description": "Assets under management range"},
            ],
            "examples": ["Canada Pension Plan", "Brookfield AM", "Caisse de depot"],
        },
        {
            "name": "Regulator",
            "description": "A government or regulatory body affecting markets",
            "attributes": [
                {"name": "jurisdiction", "type": "text", "description": "Regulatory jurisdiction"},
            ],
            "examples": ["Bank of Canada", "OSC", "OSFI"],
        },
        {
            "name": "MediaOutlet",
            "description": "A financial news publication or media organization",
            "attributes": [
                {"name": "media_type", "type": "text", "description": "Print, broadcast, digital"},
            ],
            "examples": ["BNN Bloomberg", "Globe and Mail", "Financial Post"],
        },
        {
            "name": "Company",
            "description": "A business entity that may or may not be publicly traded",
            "attributes": [
                {"name": "industry", "type": "text", "description": "Primary industry"},
            ],
            "examples": ["Shopify", "Enbridge", "Royal Bank"],
        },
        {
            "name": "MarketEvent",
            "description": "A significant market-moving event or announcement",
            "attributes": [
                {"name": "event_type", "type": "text", "description": "Rate decision, earnings, policy, etc."},
                {"name": "impact_level", "type": "text", "description": "High, medium, or low impact"},
            ],
            "examples": ["Rate cut announcement", "Oil price shock", "Earnings beat"],
        },
        {
            "name": "Organization",
            "description": "Any other relevant organization not covered above",
            "attributes": [
                {"name": "org_type", "type": "text", "description": "Type of organization"},
            ],
            "examples": ["OPEC", "IMF", "G7"],
        },
    ],
    "edge_types": [
        {
            "name": "BELONGS_TO_SECTOR",
            "description": "Stock belongs to a sector",
            "source_targets": [{"source": "Stock", "target": "Sector"}],
        },
        {
            "name": "COVERS",
            "description": "Analyst covers or rates a stock",
            "source_targets": [{"source": "Analyst", "target": "Stock"}],
        },
        {
            "name": "INVESTS_IN",
            "description": "Investor holds or trades a stock",
            "source_targets": [
                {"source": "RetailInvestor", "target": "Stock"},
                {"source": "InstitutionalInvestor", "target": "Stock"},
            ],
        },
        {
            "name": "REGULATES",
            "description": "Regulator oversees or affects a sector or stock",
            "source_targets": [
                {"source": "Regulator", "target": "Sector"},
                {"source": "Regulator", "target": "Stock"},
            ],
        },
        {
            "name": "REPORTS_ON",
            "description": "Media outlet publishes news about a stock or event",
            "source_targets": [
                {"source": "MediaOutlet", "target": "Stock"},
                {"source": "MediaOutlet", "target": "MarketEvent"},
            ],
        },
        {
            "name": "AFFECTED_BY",
            "description": "Stock or sector is affected by a market event",
            "source_targets": [
                {"source": "Stock", "target": "MarketEvent"},
                {"source": "Sector", "target": "MarketEvent"},
            ],
        },
        {
            "name": "COMPETES_WITH",
            "description": "Companies competing in the same space",
            "source_targets": [{"source": "Stock", "target": "Stock"}],
        },
        {
            "name": "OPERATES_AS",
            "description": "Company operates as a publicly traded stock",
            "source_targets": [{"source": "Company", "target": "Stock"}],
        },
    ],
}


def get_financial_ontology() -> dict:
    """Return the pre-built financial ontology for MiroFish."""
    return FINANCIAL_ONTOLOGY


def build_financial_documents(
    article_ids: list[int] | None = None,
    signal_ids: list[int] | None = None,
    days: int = 7,
    db: "Session | None" = None,
) -> list[str]:
    """Convert articles and signals into text documents for MiroFish ingestion."""
    if db is None:
        return []

    from app.models import Article, Signal

    documents = []

    # Collect articles
    query = db.query(Article)
    if article_ids:
        query = query.filter(Article.id.in_(article_ids))
    else:
        cutoff = datetime.utcnow() - timedelta(days=days)
        query = query.filter(Article.published_at >= cutoff).order_by(
            Article.published_at.desc()
        )
    articles = query.limit(50).all()

    for article in articles:
        doc = f"ARTICLE: {article.title}\n"
        doc += f"Source: {article.source}\n"
        if article.published_at:
            doc += f"Date: {article.published_at.strftime('%Y-%m-%d')}\n"
        if article.content:
            doc += f"\n{article.content[:3000]}\n"
        elif article.summary:
            doc += f"\n{article.summary}\n"
        documents.append(doc)

    # Collect signals and add as context
    sig_query = db.query(Signal)
    if signal_ids:
        sig_query = sig_query.filter(Signal.id.in_(signal_ids))
    else:
        cutoff = datetime.utcnow() - timedelta(days=days)
        sig_query = sig_query.filter(Signal.created_at >= cutoff).order_by(
            Signal.created_at.desc()
        )
    signals = sig_query.limit(100).all()

    if signals:
        signals_doc = "MARKET SIGNALS SUMMARY:\n\n"
        for sig in signals:
            signals_doc += (
                f"- {sig.stock_ticker} ({sig.stock_name}): "
                f"{sig.direction} signal, confidence {sig.confidence:.0%}, "
                f"sentiment {sig.sentiment}"
            )
            if sig.impact_hypothesis:
                signals_doc += f" — {sig.impact_hypothesis}"
            signals_doc += "\n"
        documents.append(signals_doc)

    # Add stock universe context
    stock_context = "TSX STOCK UNIVERSE:\n\n"
    for ticker, name in settings.tsx_stocks.items():
        sector = settings.stock_sectors.get(ticker, "Other")
        stock_context += f"- {ticker}: {name} (Sector: {sector})\n"
    documents.append(stock_context)

    return documents


def map_signals_to_requirement(signals_description: str) -> str:
    """Convert a description or set of signals into a MiroFish simulation requirement."""
    return (
        f"Simulate how different types of financial market participants "
        f"(analysts, institutional investors, retail investors, regulators, media) "
        f"would react to and discuss the following market situation on social media "
        f"platforms like Twitter and Reddit. Focus on the Canadian TSX market. "
        f"Context: {signals_description}"
    )


def build_scenario_documents(
    scenario_text: str,
    target_tickers: list[str] | None = None,
    db: "Session | None" = None,
) -> list[str]:
    """Create document context for scenario simulations."""
    documents = []

    # Scenario description as primary document
    scenario_doc = f"MARKET SCENARIO:\n\n{scenario_text}\n\n"
    scenario_doc += (
        "This is a hypothetical scenario being analyzed for its potential impact "
        "on the Canadian stock market (TSX). Market participants should discuss "
        "how this scenario would affect specific stocks, sectors, and the broader market."
    )
    documents.append(scenario_doc)

    # Add relevant articles if DB available
    if db and target_tickers:
        from app.models import Signal, Article

        recent_signals = (
            db.query(Signal)
            .filter(Signal.stock_ticker.in_(target_tickers))
            .order_by(Signal.created_at.desc())
            .limit(20)
            .all()
        )
        if recent_signals:
            context_doc = "RECENT MARKET CONTEXT FOR AFFECTED STOCKS:\n\n"
            for sig in recent_signals:
                context_doc += (
                    f"- {sig.stock_ticker}: {sig.direction} signal "
                    f"(confidence {sig.confidence:.0%}), {sig.reasoning or ''}\n"
                )
            documents.append(context_doc)

    # Add affected stocks info
    if target_tickers:
        stocks_doc = "TARGET STOCKS FOR SCENARIO ANALYSIS:\n\n"
        for ticker in target_tickers:
            name = settings.tsx_stocks.get(ticker, "Unknown")
            sector = settings.stock_sectors.get(ticker, "Other")
            stocks_doc += f"- {ticker}: {name} (Sector: {sector})\n"
        documents.append(stocks_doc)

    # Add stock universe
    stock_context = "TSX STOCK UNIVERSE:\n\n"
    for ticker, name in settings.tsx_stocks.items():
        sector = settings.stock_sectors.get(ticker, "Other")
        stock_context += f"- {ticker}: {name} (Sector: {sector})\n"
    documents.append(stock_context)

    return documents


def build_investor_profiles(context: str) -> list[dict]:
    """Create investor persona descriptions for OASIS agent profile generation."""
    return [
        {
            "name": "Value Investor",
            "persona": (
                "A patient, fundamentals-focused investor who looks for undervalued "
                "stocks with strong balance sheets and low P/E ratios. Skeptical of "
                "hype and momentum. Prefers dividend-paying Canadian blue chips. "
                f"Analyzing: {context}"
            ),
            "investment_style": "value",
            "risk_profile": "moderate",
        },
        {
            "name": "Growth Trader",
            "persona": (
                "An aggressive growth-oriented trader who focuses on revenue growth, "
                "market expansion, and technical breakouts. Comfortable with volatility. "
                "Favors tech and high-growth TSX stocks like SHOP.TO, CSU.TO. "
                f"Analyzing: {context}"
            ),
            "investment_style": "growth",
            "risk_profile": "high",
        },
        {
            "name": "Macro Analyst",
            "persona": (
                "A top-down macro strategist who analyzes Bank of Canada policy, "
                "commodity prices, USD/CAD, and global economic trends. Views individual "
                "stocks through the lens of macro cycles and sector rotation. "
                f"Analyzing: {context}"
            ),
            "investment_style": "macro",
            "risk_profile": "moderate",
        },
        {
            "name": "Risk Manager",
            "persona": (
                "A conservative risk-focused professional who prioritizes capital "
                "preservation. Looks for downside risks, tail events, and correlation "
                "risks. Often takes contrarian positions. Manages pension fund allocations. "
                f"Analyzing: {context}"
            ),
            "investment_style": "risk_averse",
            "risk_profile": "low",
        },
        {
            "name": "Retail Investor",
            "persona": (
                "An enthusiastic individual investor active on Reddit and social media. "
                "Follows popular narratives and social sentiment. May have FOMO tendencies "
                "but also brings grassroots market sentiment perspective. "
                f"Analyzing: {context}"
            ),
            "investment_style": "sentiment",
            "risk_profile": "high",
        },
    ]
