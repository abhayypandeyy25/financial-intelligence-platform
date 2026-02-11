from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey, Table, BigInteger
from sqlalchemy.orm import relationship

from app.database import Base

# Many-to-many: themes <-> articles
theme_articles = Table(
    "theme_articles",
    Base.metadata,
    Column("theme_id", Integer, ForeignKey("themes.id"), primary_key=True),
    Column("article_id", Integer, ForeignKey("articles.id"), primary_key=True),
)


class Article(Base):
    __tablename__ = "articles"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    source = Column(String(100), nullable=False)
    url = Column(String(1000), nullable=False, unique=True)
    url_hash = Column(String(64), nullable=False, unique=True, index=True)
    published_at = Column(DateTime, nullable=True)
    ingested_at = Column(DateTime, default=datetime.utcnow)
    processed = Column(Boolean, default=False)

    signals = relationship("Signal", back_populates="article")
    themes = relationship("Theme", secondary=theme_articles, back_populates="articles")


class Signal(Base):
    __tablename__ = "signals"

    id = Column(Integer, primary_key=True, index=True)
    article_id = Column(Integer, ForeignKey("articles.id"), nullable=False)
    stock_ticker = Column(String(20), nullable=False, index=True)
    stock_name = Column(String(200), nullable=True)
    sector = Column(String(50), nullable=True)
    sentiment = Column(String(10), nullable=False)  # positive, negative, neutral
    confidence = Column(Float, nullable=False)
    reasoning = Column(Text, nullable=True)
    direction = Column(String(10), nullable=True)  # up, down
    impact_hypothesis = Column(Text, nullable=True)
    time_horizon = Column(String(20), nullable=True)  # short, medium, long
    insight_type = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    article = relationship("Article", back_populates="signals")
    backtest_results = relationship("BacktestResult", back_populates="signal")


class BacktestResult(Base):
    __tablename__ = "backtest_results"

    id = Column(Integer, primary_key=True, index=True)
    signal_id = Column(Integer, ForeignKey("signals.id"), nullable=False)
    ticker = Column(String(20), nullable=False)
    signal_date = Column(DateTime, nullable=False)
    direction_predicted = Column(String(10), nullable=False)  # up, down
    price_at_signal = Column(Float, nullable=True)
    price_1d = Column(Float, nullable=True)
    price_7d = Column(Float, nullable=True)
    price_30d = Column(Float, nullable=True)
    actual_1d_change = Column(Float, nullable=True)
    actual_7d_change = Column(Float, nullable=True)
    actual_30d_change = Column(Float, nullable=True)
    accurate_1d = Column(Boolean, nullable=True)
    accurate_7d = Column(Boolean, nullable=True)
    accurate_30d = Column(Boolean, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    signal = relationship("Signal", back_populates="backtest_results")


class Theme(Base):
    __tablename__ = "themes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    sector = Column(String(50), nullable=True)
    relevance_score = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    articles = relationship("Article", secondary=theme_articles, back_populates="themes")


class StockQuote(Base):
    """Real-time stock quote data from web scraping."""
    __tablename__ = "stock_quotes"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String(20), nullable=False, index=True)
    company_name = Column(String(200), nullable=True)
    exchange = Column(String(10), nullable=True)  # TSX, TSXV, NASDAQ, etc.

    # Price data
    current_price = Column(Float, nullable=True)
    open_price = Column(Float, nullable=True)
    high_price = Column(Float, nullable=True)
    low_price = Column(Float, nullable=True)
    previous_close = Column(Float, nullable=True)

    # Volume and market data
    volume = Column(BigInteger, nullable=True)
    market_cap = Column(BigInteger, nullable=True)
    pe_ratio = Column(Float, nullable=True)
    dividend_yield = Column(Float, nullable=True)

    # Change metrics
    price_change = Column(Float, nullable=True)
    percent_change = Column(Float, nullable=True)

    # Metadata
    source = Column(String(100), nullable=False)  # TMX Money, Yahoo Finance, etc.
    quote_time = Column(DateTime, nullable=True)
    ingested_at = Column(DateTime, default=datetime.utcnow)


class SentimentData(Base):
    """Community sentiment data from Reddit, forums, etc."""
    __tablename__ = "sentiment_data"

    id = Column(Integer, primary_key=True, index=True)
    source = Column(String(50), nullable=False)  # reddit, twitter, stocktwits
    source_type = Column(String(20), nullable=False)  # community, social

    # Content
    content = Column(Text, nullable=False)
    author = Column(String(100), nullable=True)
    url = Column(String(1000), nullable=False, unique=True)
    url_hash = Column(String(64), nullable=False, unique=True, index=True)

    # Metadata
    posted_at = Column(DateTime, nullable=True)
    ingested_at = Column(DateTime, default=datetime.utcnow)

    # Community metrics
    upvotes = Column(Integer, default=0)
    comments_count = Column(Integer, default=0)

    # Extracted entities (stocks mentioned)
    tickers_mentioned = Column(Text, nullable=True)  # JSON array of tickers

    # AI-analyzed sentiment (populated by pipeline)
    sentiment = Column(String(10), nullable=True)  # positive, negative, neutral
    confidence = Column(Float, nullable=True)
    processed = Column(Boolean, default=False)


class Top100Stock(Base):
    """Top 100 TSX stocks by market cap, volume, or other criteria."""
    __tablename__ = "top_100_stocks"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String(20), nullable=False, unique=True, index=True)
    company_name = Column(String(200), nullable=False)
    exchange = Column(String(10), nullable=False)  # TSX, TSXV
    sector = Column(String(50), nullable=True)

    # Ranking criteria
    market_cap_rank = Column(Integer, nullable=True)
    volume_rank = Column(Integer, nullable=True)
    performance_rank = Column(Integer, nullable=True)

    # Flags
    is_active = Column(Boolean, default=True)
    last_updated = Column(DateTime, default=datetime.utcnow)

    # Selection criteria note
    selection_criteria = Column(String(100), nullable=True)  # "market_cap", "volume", etc.
