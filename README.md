# Financial Intelligence Platform - TSX Pilot

AI-powered financial news analysis and signal extraction for the Canadian market.

**Pipeline:** News Sources → Entity Extraction → Sentiment Analysis → Signal Generation → Back-testing

## Quick Start

### 1. Backend (Python FastAPI)

```bash
cd backend
pip install -r requirements.txt

# Add your Anthropic API key
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" > .env

# Start the server
python3 -m uvicorn app.main:app --reload
# API docs at http://localhost:8000/docs
```

### 2. Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
# Dashboard at http://localhost:3000
```

### 3. Seed Demo Data (optional)

```bash
cd backend
python3 scripts/seed_backtest.py
```

This ingests RSS news, processes through Claude AI agents, and back-tests against real TSX market data.

## Project Structure

```
├── docs/          PRD and Executive Brief
├── backend/       Python FastAPI + Claude AI agents
│   ├── app/
│   │   ├── agents/    Entity, Sentiment, Signal, Theme agents
│   │   ├── services/  Ingestion, Back-testing, Scheduler
│   │   └── routers/   API endpoints
│   └── scripts/       Seed script
└── frontend/      Next.js dashboard (5 pages)
```

## Tech Stack

- **Backend:** Python, FastAPI, SQLAlchemy, SQLite
- **AI:** Anthropic Claude Sonnet
- **Market Data:** yfinance (free)
- **News:** RSS feeds (Financial Post, Globe and Mail, BNN, Yahoo Finance, Reuters)
- **Frontend:** Next.js 14, TypeScript, Tailwind CSS, Recharts

## Dashboard Pages

| Page | Description |
|------|-------------|
| Dashboard | Summary stats, latest signals, sentiment distribution |
| Signals | Filterable signal feed (sector, sentiment, confidence) |
| News | Ingested articles with processing status |
| Back-test | Accuracy metrics, sector charts, results table |
| Themes | Investment themes and ontology framework |
