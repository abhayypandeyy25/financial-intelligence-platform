from __future__ import annotations

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    database_url: str = "sqlite:///./fip.db"
    claude_model: str = "claude-sonnet-4-20250514"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Render gives postgres:// but SQLAlchemy needs postgresql://
        if self.database_url.startswith("postgres://"):
            object.__setattr__(self, "database_url", self.database_url.replace("postgres://", "postgresql://", 1))

    # RSS feed sources for Canadian financial news
    rss_feeds: dict[str, str] = {
        "Financial Post": "https://financialpost.com/feed",
        "Globe and Mail Business": "https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/business/",
        "Yahoo Finance Canada": "https://finance.yahoo.com/news/rssindex",
        "BNN Bloomberg": "https://www.bnnbloomberg.ca/arc/outboundfeeds/rss/category/news/",
        "Reuters Business": "https://www.reutersagency.com/feed/?best-topics=business-finance",
    }

    # Top TSX stocks for entity linking
    tsx_stocks: dict[str, str] = {
        "RY.TO": "Royal Bank of Canada",
        "TD.TO": "Toronto-Dominion Bank",
        "BNS.TO": "Bank of Nova Scotia",
        "BMO.TO": "Bank of Montreal",
        "CM.TO": "Canadian Imperial Bank of Commerce",
        "ENB.TO": "Enbridge Inc",
        "CNQ.TO": "Canadian Natural Resources",
        "SU.TO": "Suncor Energy",
        "TRP.TO": "TC Energy",
        "CP.TO": "Canadian Pacific Kansas City",
        "CNR.TO": "Canadian National Railway",
        "MFC.TO": "Manulife Financial",
        "SLF.TO": "Sun Life Financial",
        "ABX.TO": "Barrick Gold",
        "NTR.TO": "Nutrien Ltd",
        "FNV.TO": "Franco-Nevada Corp",
        "WCN.TO": "Waste Connections",
        "CSU.TO": "Constellation Software",
        "ATD.TO": "Alimentation Couche-Tard",
        "QSR.TO": "Restaurant Brands International",
        "SHOP.TO": "Shopify Inc",
        "BCE.TO": "BCE Inc",
        "T.TO": "Telus Corp",
        "GIB-A.TO": "CGI Inc",
        "DOL.TO": "Dollarama Inc",
        "L.TO": "Loblaw Companies",
        "MG.TO": "Magna International",
        "IMO.TO": "Imperial Oil",
        "CVE.TO": "Cenovus Energy",
        "TOU.TO": "Tourmaline Oil",
        "FM.TO": "First Quantum Minerals",
        "TECK-B.TO": "Teck Resources",
        "AGI.TO": "Alamos Gold",
        "K.TO": "Kinross Gold",
        "AEM.TO": "Agnico Eagle Mines",
        "WPM.TO": "Wheaton Precious Metals",
        "IFC.TO": "Intact Financial",
        "GWO.TO": "Great-West Lifeco",
        "POW.TO": "Power Corporation",
        "FFH.TO": "Fairfax Financial",
        "BAM.TO": "Brookfield Asset Management",
        "BN.TO": "Brookfield Corporation",
        "RCI-B.TO": "Rogers Communications",
        "SAP.TO": "Saputo Inc",
        "CCL-B.TO": "CCL Industries",
        "WFG.TO": "West Fraser Timber",
        "AQN.TO": "Algonquin Power",
        "H.TO": "Hydro One",
        "FTS.TO": "Fortis Inc",
        "EMA.TO": "Emera Inc",
    }

    # Ontology / Taxonomy
    sectors: list[str] = ["Energy", "Mining", "Finance", "Technology", "Healthcare"]
    geographies: list[str] = ["Canada"]
    exchanges: list[str] = ["TSX", "TSX-V"]
    asset_classes: list[str] = ["Individual Stocks", "Sector ETFs", "TSX Composite Index"]
    insight_types: list[str] = ["Event-driven", "Sentiment", "Policy", "Earnings"]

    # Sector mapping for TSX stocks
    stock_sectors: dict[str, str] = {
        "RY.TO": "Finance", "TD.TO": "Finance", "BNS.TO": "Finance",
        "BMO.TO": "Finance", "CM.TO": "Finance", "MFC.TO": "Finance",
        "SLF.TO": "Finance", "IFC.TO": "Finance", "GWO.TO": "Finance",
        "POW.TO": "Finance", "FFH.TO": "Finance", "BAM.TO": "Finance",
        "BN.TO": "Finance",
        "ENB.TO": "Energy", "CNQ.TO": "Energy", "SU.TO": "Energy",
        "TRP.TO": "Energy", "IMO.TO": "Energy", "CVE.TO": "Energy",
        "TOU.TO": "Energy", "AQN.TO": "Energy", "H.TO": "Energy",
        "FTS.TO": "Energy", "EMA.TO": "Energy",
        "ABX.TO": "Mining", "NTR.TO": "Mining", "FNV.TO": "Mining",
        "FM.TO": "Mining", "TECK-B.TO": "Mining", "AGI.TO": "Mining",
        "K.TO": "Mining", "AEM.TO": "Mining", "WPM.TO": "Mining",
        "WFG.TO": "Mining",
        "SHOP.TO": "Technology", "CSU.TO": "Technology", "GIB-A.TO": "Technology",
        "CP.TO": "Technology", "CNR.TO": "Technology",
        "BCE.TO": "Technology", "T.TO": "Technology", "RCI-B.TO": "Technology",
        "ATD.TO": "Healthcare", "QSR.TO": "Healthcare", "DOL.TO": "Healthcare",
        "L.TO": "Healthcare", "MG.TO": "Healthcare", "WCN.TO": "Healthcare",
        "SAP.TO": "Healthcare", "CCL-B.TO": "Healthcare",
    }

    # Web scraping configuration
    scraping_enabled: bool = True
    scraping_timeout: int = 30
    scraping_delay: float = 1.0
    scraping_max_retries: int = 3

    # News sources (web scraping)
    news_sources: dict[str, str] = {
        "Globe and Mail": "https://www.theglobeandmail.com/business/",
        "Financial Post": "https://financialpost.com",
        "BNN Bloomberg": "https://www.bnnbloomberg.ca",
        "CBC News Business": "https://www.cbc.ca/news/business",
        "Global News Money": "https://globalnews.ca/money/",
        "TMX News": "https://www.tsx.com/en/news",
        "Investment Executive": "https://www.investmentexecutive.com",
        "Yahoo Finance Canada": "https://ca.finance.yahoo.com/news/",
    }

    # Stock data sources
    stock_data_sources: dict[str, str] = {
        "TMX Money": "https://money.tmx.com",
        "Yahoo Finance": "https://ca.finance.yahoo.com",
    }

    # Sentiment sources
    sentiment_sources: dict[str, str] = {
        "Reddit CanadianInvestor": "https://www.reddit.com/r/CanadianInvestor",
        "Reddit CanadaFinance": "https://www.reddit.com/r/CanadaFinance",
    }

    # Reddit API credentials
    reddit_client_id: str = ""
    reddit_client_secret: str = ""
    reddit_user_agent: str = "FinancialIntelligencePlatform/1.0"

    # Twitter/X API credentials
    twitter_bearer_token: str = ""
    twitter_accounts: list[str] = [
        "BNNBloomberg", "GlobeInvestor", "FinancialPost",
        "CBCBusiness", "tsx_tsxv", "YahooFinanceCA",
        "BankOfCanada", "RBCCapitalMkts",
    ]
    twitter_search_keywords: list[str] = [
        "TSX", "$TSX", "Canadian stocks", "Bank of Canada",
        "TSX Composite", "Canadian dollar", "oil sands Alberta",
    ]

    # Top 100 selection criteria
    top_100_criteria: str = "market_cap"
    top_100_refresh_hours: int = 24

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
