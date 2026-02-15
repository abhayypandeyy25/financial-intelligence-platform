import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import news, signals, backtest, dashboard, themes, stocks, sentiment, stock_detail, search, chat, sources

app = FastAPI(
    title="Financial Intelligence Platform",
    description="AI-powered financial news analysis and signal extraction for the Canadian market",
    version="0.1.0",
)

# CORS: allow local dev + Vercel production frontend
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://financial-intelligence-tsx.vercel.app",
]
# Allow extra origins from env (comma-separated)
extra_origins = os.getenv("CORS_ORIGINS", "")
if extra_origins:
    allowed_origins.extend([o.strip() for o in extra_origins.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(news.router)
app.include_router(signals.router)
app.include_router(backtest.router)
app.include_router(dashboard.router)
app.include_router(themes.router)
app.include_router(stocks.router)
app.include_router(sentiment.router)
app.include_router(stock_detail.router)
app.include_router(search.router)
app.include_router(chat.router)
app.include_router(sources.router)


@app.on_event("startup")
def startup():
    init_db()

    # Populate Top 100 stock universe + initial quote fetch if empty
    from app.database import get_db
    db = next(get_db())
    try:
        from app.models import Top100Stock, StockQuote
        if db.query(Top100Stock).count() == 0:
            from app.services.scrapers.stock_scrapers import YFinanceStockScraper
            scraper = YFinanceStockScraper()
            scraper.update_top_100_universe(db)
            print("Startup: Populated Top 100 stock universe")
        if db.query(StockQuote).count() == 0:
            from app.services.scrapers.stock_scrapers import YFinanceStockScraper
            scraper = YFinanceStockScraper()
            scraper.fetch_top_tsx_quotes(db=db)
            print("Startup: Fetched initial stock quotes")
    except Exception as e:
        print(f"Startup stock init warning: {e}")
    finally:
        db.close()

    # Start background scheduler for periodic ingestion
    from app.services.scheduler import start_scheduler
    start_scheduler()


@app.on_event("shutdown")
def shutdown():
    from app.services.scheduler import stop_scheduler
    stop_scheduler()


@app.get("/")
def root():
    return {
        "name": "Financial Intelligence Platform",
        "version": "0.1.0",
        "status": "running",
        "docs": "/docs",
    }
