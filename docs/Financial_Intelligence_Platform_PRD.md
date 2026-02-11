# PRODUCT REQUIREMENTS DOCUMENT
## Financial Intelligence Platform
### MVP Scope | Version 1.0 | January 2026

---

| **Product Owner** | Nandan Mishra | **Status** | Draft - Pilot Ready |
|-------------------|---------------|------------|---------------------|
| **Tech Lead** | Himanshu Singh | **Target Market** | Canada (Pilot), US, Europe, India |

---

## 1. Executive Summary

This document outlines the MVP requirements for a **Financial Intelligence Platform** that aggregates financial news from curated sources, extracts actionable investment signals, and validates them through back-testing. The platform aims to democratize access to institutional-grade financial intelligence currently dominated by Thomson Reuters, Wolters Kluwer, and LexisNexis.

---

## 2. Problem Statement

### 2.1 The Core Problem

Investment professionals need to make decisions based on news and market signals, but face critical challenges:

- **Fragmented Information:** Financial news is scattered across 200-500+ sources with no unified view

- **Raw News ≠ Insights:** As Nandan stated: *"News is not just news—you need to understand how an insight comes out of two things: there is a worldview and there is a model we'll build as a frame of reference."*

- **No Validation Mechanism:** Investors cannot easily verify if news signals actually correlate with market outcomes

- **Expensive Incumbents:** Existing solutions (Bloomberg Terminal, Reuters) cost $20,000+ annually, accessible only to large institutions

### 2.2 Stakeholder Quote

> *"News is a very leading indicator... Back-testing is an important part—we've discussed that. So we want to detect themes from those news sources, extract signals from them, and after signals, back-test them. Those are the parts we want to do."*
>
> **— Nandan Mishra**

---

## 3. Solution Overview

Build an AI-powered financial intelligence platform with four processing layers:

| Layer | Function | Output |
|-------|----------|--------|
| **1. Ingestion** | Aggregate 15-20 curated financial news sources | Unified news feed with metadata (source, time, entities) |
| **2. Ontology** | Classify by sector, geography, asset class, insight type | Structured taxonomy of investment insights |
| **3. Signals** | Extract themes, sentiment, entity links, impact hypothesis | Actionable investment signals with confidence scores |
| **4. Validation** | Back-test signals against historical market data | Validated signals with accuracy metrics |

---

## 4. Why This Product (Market Opportunity)

### 4.1 Market Size

Nandan referenced that companies in this space (Thomson Reuters, LexisNexis, Wolters Kluwer) influence **~$20 trillion in investment decisions**. The financial data and analytics market is valued at $35B+ globally with 10%+ CAGR.

### 4.2 Competitive Landscape

| Competitor | What They Do | Our Advantage |
|------------|--------------|---------------|
| **Thomson Reuters** | Enterprise financial data & news | AI-native, 10x cheaper, back-testing built-in |
| **Bloomberg Terminal** | Real-time market data & analytics | Focus on signal extraction & validation |
| **LexisNexis** | Legal & business research | Investment-focused ontology |

### 4.3 Whitespace Opportunity

> *"So understand—companies like LexisNexis, Brandwood, whatever I just wrote and sent—they do 7, 8, 9, 10 and do videos and give to their securities... We want to detect themes from those news sources, extract signals from them, and after signals, back-test them."*
>
> **— Nandan Mishra**

---

## 5. User Personas

### Persona 1: Index Fund Manager
- **Role:** Manages index funds (Nifty 50, S&P 500, sector ETFs)
- **Pain Point:** Needs to understand what drives index movements
- **Use Case:** Link news to index performance; as Nandan said: *"If you want to make a copper index, you'll identify it and then what should its weight be?"*

### Persona 2: Quantitative Analyst
- **Role:** Builds trading algorithms at hedge funds
- **Pain Point:** Needs machine-readable signals from news
- **Use Case:** API feed of validated signals for algorithmic trading

### Persona 3: Research Analyst
- **Role:** Publishes investment research reports
- **Pain Point:** Spends 60%+ time aggregating news manually
- **Use Case:** Auto-generated thematic reports from curated sources

---

## 6. Functional Requirements (MVP)

### 6.1 Three-Step Processing Pipeline

As Himanshu elaborated in the meeting:

> *"So the three steps: First is finding sources. The outcome we want is to make predictions for stocks directly or for indexes derived from stocks—what impact news has on them... Second is converting it into sentiment... linking to an outcome or stock, whether it's positive or negative, and the key is the headline—why it's negative. We extract these two pieces of information and try to see: news came, we linked it, but did it actually show impact or not?"*
>
> **— Himanshu Singh**

### Step 1: Source Acquisition
- Integrate 15-20 curated financial news sources (MVP scope)
- Sources: Twitter/X financial feeds, RSS from major publications, Reuters, Bloomberg snippets
- Real-time ingestion with <5 minute latency

### Step 2: Signal Processing
- **Entity Linking:** Map news to specific stocks, indexes, commodities
- **Sentiment Analysis:** Classify as positive/negative/neutral with confidence score
- **Theme Detection:** Identify recurring investment themes (e.g., "EV adoption", "Fed hawkish")
- **Impact Hypothesis:** Generate "why" explanation for predicted impact

### Step 3: Validation & Back-testing
- Compare historical signals against actual market movements
- Time-series window analysis (1-day, 7-day, 30-day impact)
- Generate accuracy metrics and confidence intervals

> ⚠️ **Challenge Note:** *"This part is a bit tricky because news is often not time-bound. Sometimes something comes like, 'This policy changed, so car stocks will go up,' but when will they go up? For that you'd need a time-series window."* **— Himanshu Singh**

### 6.2 Ontology Framework

Per Nandan's framework: *"The biggest sector first, then geography within the sector, then different classes within that. So we'll need to define the basic ontology of investment insights."*

| Hierarchy | MVP Scope | Examples |
|-----------|-----------|----------|
| **Sector** | 5 major sectors | Tech, Energy, Finance, Healthcare, Materials |
| **Geography** | Canada (pilot), then US | TSX, NYSE, NASDAQ |
| **Asset Class** | Stocks & Indexes | Individual stocks, Sector ETFs, Nifty/S&P |
| **Insight Type** | 4 signal types | Event-driven, Sentiment, Policy, Earnings |

---

## 7. Technical Architecture (CTO View)

### 7.1 System Architecture Overview

The platform follows a **multi-agent architecture** with specialized AI agents for each processing layer, orchestrated through an event-driven pipeline.

```
┌─────────────────────────────────────────────────────────────────────┐
│  DATA SOURCES (15-20)                                               │
│  [Twitter/X] [RSS Feeds] [Reuters] [Financial APIs] [SEC Filings]  │
└────────────────────────────┬────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  INGESTION LAYER                                                    │
│  [Kafka/Pub-Sub] → [Dedup Agent] → [Normalization Agent]           │
└────────────────────────────┬────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PROCESSING LAYER (Agentic Flows)                                   │
│  [Entity Agent] → [Sentiment Agent] → [Theme Agent] → [Signal Agent]│
└────────────────────────────┬────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  VALIDATION LAYER                                                   │
│  [Back-test Agent] → [Market Data API] → [Accuracy Scorer]         │
└────────────────────────────┬────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  OUTPUT LAYER                                                       │
│  [API Gateway] [Dashboard] [Report Generator] [Alerts Engine]      │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 Agentic Flows & AI Agents

| Agent Name | Function | Model | Tools |
|------------|----------|-------|-------|
| **Ingestion Agent** | Fetch, deduplicate, normalize news | Claude Haiku | RSS, Twitter API, Web Scraper |
| **Entity Agent** | Extract & link companies, stocks, indexes | Claude Sonnet | Entity DB, Stock API |
| **Sentiment Agent** | Analyze sentiment, extract 'why' | Claude Sonnet | Prompt chains |
| **Theme Agent** | Cluster news into investment themes | Claude Opus | Vector DB, Clustering |
| **Signal Agent** | Generate actionable investment signals | Claude Opus | Ontology, Rules Engine |
| **Backtest Agent** | Validate signals against market data | Python + Claude | Market Data API, Stats |

### 7.3 Data Pipeline Workflow

1. **Ingest:** News arrives via webhooks/polling → Kafka topic 'raw-news'
2. **Normalize:** Ingestion Agent cleans, deduplicates → 'normalized-news' topic
3. **Enrich:** Entity + Sentiment Agents process in parallel → 'enriched-news' topic
4. **Classify:** Theme Agent clusters into ontology → stored in Vector DB
5. **Signal:** Signal Agent generates investment signals → 'signals' topic
6. **Validate:** Backtest Agent runs async validation → updates signal confidence

### 7.4 Tech Stack

| Component | Technology Choice |
|-----------|-------------------|
| **LLM Provider** | Anthropic Claude (Haiku/Sonnet/Opus based on task) |
| **Agent Framework** | LangGraph / CrewAI for multi-agent orchestration |
| **Message Queue** | Apache Kafka / Google Pub-Sub |
| **Vector Database** | Pinecone / Weaviate for semantic search & theme clustering |
| **Primary Database** | PostgreSQL with TimescaleDB extension for time-series |
| **Market Data** | Alpha Vantage / Polygon.io / Yahoo Finance API |
| **Backend** | Python FastAPI / Node.js for API layer |
| **Frontend** | React + Next.js dashboard |
| **Infrastructure** | AWS / GCP with Kubernetes for scaling |

---

## 8. MVP Scope & Deliverables

### 8.1 MVP Feature Set

| Feature | Priority | Acceptance Criteria |
|---------|----------|---------------------|
| 15 News Source Integration | **P0** | <5 min latency, 95%+ uptime |
| Entity Extraction & Linking | **P0** | 90%+ accuracy on stock/company linking |
| Sentiment Analysis with 'Why' | **P0** | Sentiment + reasoning for each signal |
| Theme Detection (5 Themes) | **P1** | Cluster news into predefined themes |
| Back-testing Engine | **P0** | 1-day, 7-day, 30-day windows |
| Dashboard with Signal Feed | **P0** | Real-time feed with filters |
| API Access | **P1** | REST API for signal consumption |
| Report Generation | **P2** | Weekly digest reports |

### 8.2 Pilot Configuration

- **Market:** Canadian market (TSX) — as Nandan noted: *"Create a similar pilot for the Canadian market—it might be easier there. Prices might be higher there."*
- **Sources:** 15 curated Canadian financial news sources
- **Sectors:** Energy, Mining, Finance (top 3 Canadian sectors)
- **Duration:** 8-week pilot with 3-5 beta users

---

## 9. Success Metrics

| Metric | Target (MVP) | Measurement |
|--------|--------------|-------------|
| Signal Accuracy | >60% directional accuracy | Back-test validation |
| Entity Linking Accuracy | >90% correct linking | Manual QA sampling |
| Processing Latency | <5 minutes end-to-end | Pipeline monitoring |
| User Engagement | Daily active usage | Analytics dashboard |

---

## 10. Development Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **Phase 1** | Week 1-2: Foundation | Infrastructure setup, 5 source integrations, basic ingestion pipeline |
| **Phase 2** | Week 3-4: Processing | Entity, Sentiment, Theme agents; Ontology framework |
| **Phase 3** | Week 5-6: Validation | Back-testing engine, Market data integration, Signal scoring |
| **Phase 4** | Week 7-8: UI & Pilot | Dashboard, API endpoints, Beta testing with pilot users |

---

## 11. Open Questions & Risks

1. **Time-series Window:** How do we define the optimal window for measuring news impact? (Flagged by Himanshu)

2. **Source Access:** Which sources are freely available vs. require paid API access?

3. **Worldview Configuration:** How do users customize the 'worldview' for their investment philosophy?

4. **Regulatory:** Any compliance requirements for financial signal distribution?

5. **Pricing Model:** Subscription tiers vs. pay-per-signal vs. enterprise licensing?

---

*Document Version: 1.0 | Last Updated: January 2026*

*Prepared for: S1 Huddle Team | Next Review: Monday/Tuesday meeting*
