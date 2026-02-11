from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import news, signals, backtest, dashboard, themes, stocks, sentiment

app = FastAPI(
    title="Financial Intelligence Platform",
    description="AI-powered financial news analysis and signal extraction for the Canadian market",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
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


@app.on_event("startup")
def startup():
    init_db()
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
