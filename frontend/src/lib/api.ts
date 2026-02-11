const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// Types
export interface Article {
  id: number;
  title: string;
  summary: string | null;
  source: string;
  url: string;
  published_at: string | null;
  ingested_at: string | null;
  processed: boolean;
}

export interface Signal {
  id: number;
  article_id: number;
  stock_ticker: string;
  stock_name: string | null;
  sector: string | null;
  sentiment: string;
  confidence: number;
  reasoning: string | null;
  direction: string | null;
  impact_hypothesis: string | null;
  time_horizon: string | null;
  insight_type: string | null;
  created_at: string | null;
  article_title?: string | null;
  article_source?: string | null;
}

export interface BacktestResult {
  id: number;
  signal_id: number;
  ticker: string;
  signal_date: string;
  direction_predicted: string;
  price_at_signal: number | null;
  price_1d: number | null;
  price_7d: number | null;
  price_30d: number | null;
  actual_1d_change: number | null;
  actual_7d_change: number | null;
  actual_30d_change: number | null;
  accurate_1d: boolean | null;
  accurate_7d: boolean | null;
  accurate_30d: boolean | null;
}

export interface BacktestSummary {
  total_signals_tested: number;
  accuracy_1d: number | null;
  accuracy_7d: number | null;
  accuracy_30d: number | null;
  by_sector: Record<string, Record<string, number | null>>;
  avg_confidence: number | null;
}

export interface Theme {
  id: number;
  name: string;
  description: string | null;
  sector: string | null;
  relevance_score: number | null;
  created_at: string | null;
  article_count: number;
}

export interface DashboardSummary {
  total_articles: number;
  total_signals: number;
  signals_today: number;
  total_backtests: number;
  accuracy_1d: number | null;
  accuracy_7d: number | null;
  active_themes: number;
  latest_signals: Signal[];
  signals_by_sentiment: Record<string, number>;
  signals_by_sector: Record<string, number>;
}

export interface Ontology {
  sectors: string[];
  geographies: string[];
  exchanges: string[];
  asset_classes: string[];
  insight_types: string[];
}

// Stock types
export interface StockQuote {
  id: number;
  ticker: string;
  company_name: string | null;
  exchange: string | null;
  current_price: number | null;
  open_price: number | null;
  high_price: number | null;
  low_price: number | null;
  previous_close: number | null;
  volume: number | null;
  market_cap: number | null;
  pe_ratio: number | null;
  dividend_yield: number | null;
  price_change: number | null;
  percent_change: number | null;
  source: string;
  quote_time: string | null;
  ingested_at: string | null;
}

export interface Top100Stock {
  id: number;
  ticker: string;
  company_name: string;
  exchange: string;
  sector: string | null;
  market_cap_rank: number | null;
  is_active: boolean;
  last_updated: string | null;
}

export interface SentimentPost {
  id: number;
  source: string;
  source_type: string;
  content: string;
  author: string | null;
  url: string;
  posted_at: string | null;
  ingested_at: string | null;
  upvotes: number;
  comments_count: number;
  tickers_mentioned: string | null;
  sentiment: string | null;
  confidence: number | null;
  processed: boolean;
}

export interface SentimentSummary {
  ticker: string;
  total_mentions: number;
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  avg_confidence: number | null;
  avg_upvotes: number;
  total_comments: number;
}

// API functions
export const api = {
  // Dashboard
  getDashboard: () => fetchAPI<DashboardSummary>("/api/dashboard/summary"),

  // News
  getNews: (params?: { source?: string; processed?: boolean; skip?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.source) searchParams.set("source", params.source);
    if (params?.processed !== undefined) searchParams.set("processed", String(params.processed));
    if (params?.skip) searchParams.set("skip", String(params.skip));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    const qs = searchParams.toString();
    return fetchAPI<Article[]>(`/api/news${qs ? `?${qs}` : ""}`);
  },
  getSources: () => fetchAPI<string[]>("/api/news/sources"),
  triggerIngestion: () => fetchAPI<{ total_new: number; by_source: Record<string, number> }>("/api/news/ingest", { method: "POST" }),

  // Signals
  getSignals: (params?: { ticker?: string; sentiment?: string; sector?: string; min_confidence?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.ticker) searchParams.set("ticker", params.ticker);
    if (params?.sentiment) searchParams.set("sentiment", params.sentiment);
    if (params?.sector) searchParams.set("sector", params.sector);
    if (params?.min_confidence) searchParams.set("min_confidence", String(params.min_confidence));
    const qs = searchParams.toString();
    return fetchAPI<Signal[]>(`/api/signals${qs ? `?${qs}` : ""}`);
  },
  processSignals: () => fetchAPI<{ articles_processed: number; signals_generated: number }>("/api/signals/process", { method: "POST" }),

  // Backtest
  getBacktestResults: () => fetchAPI<BacktestResult[]>("/api/backtest/results"),
  getBacktestSummary: () => fetchAPI<BacktestSummary>("/api/backtest/summary"),
  runBacktest: () => fetchAPI<{ signals_tested: number; results_created: number }>("/api/backtest/run", { method: "POST" }),

  // Themes
  getThemes: (days?: number) => fetchAPI<Theme[]>(`/api/themes${days ? `?days=${days}` : ""}`),
  getOntology: () => fetchAPI<Ontology>("/api/themes/ontology"),
  detectThemes: () => fetchAPI<{ themes_detected: number }>("/api/themes/detect", { method: "POST" }),

  // Stocks
  getStockQuotes: (params?: { ticker?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.ticker) searchParams.set("ticker", params.ticker);
    if (params?.limit) searchParams.set("limit", String(params.limit));
    const qs = searchParams.toString();
    return fetchAPI<StockQuote[]>(`/api/stocks/quotes${qs ? `?${qs}` : ""}`);
  },
  getStockQuote: (ticker: string) => fetchAPI<StockQuote | null>(`/api/stocks/quote/${ticker}`),
  getTop100Stocks: (sector?: string) => {
    const qs = sector ? `?sector=${sector}` : "";
    return fetchAPI<Top100Stock[]>(`/api/stocks/top-100${qs}`);
  },
  getStockHistory: (ticker: string, limit?: number) =>
    fetchAPI<StockQuote[]>(`/api/stocks/${ticker}/history${limit ? `?limit=${limit}` : ""}`),
  refreshStockQuotes: (tickers?: string[]) =>
    fetchAPI<{ refreshed: number; tickers: string[] }>("/api/stocks/refresh", {
      method: "POST",
      body: tickers ? JSON.stringify(tickers) : undefined,
    }),

  // Sentiment
  getSentiment: (params?: { source?: string; ticker?: string; sentiment?: string; days?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.source) searchParams.set("source", params.source);
    if (params?.ticker) searchParams.set("ticker", params.ticker);
    if (params?.sentiment) searchParams.set("sentiment", params.sentiment);
    if (params?.days) searchParams.set("days", String(params.days));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    const qs = searchParams.toString();
    return fetchAPI<SentimentPost[]>(`/api/sentiment${qs ? `?${qs}` : ""}`);
  },
  getSentimentSummary: (ticker: string, days?: number) =>
    fetchAPI<SentimentSummary>(`/api/sentiment/summary/${ticker}${days ? `?days=${days}` : ""}`),
  refreshSentiment: () =>
    fetchAPI<{ scraped: number; sources: string[] }>("/api/sentiment/refresh", { method: "POST" }),
};
