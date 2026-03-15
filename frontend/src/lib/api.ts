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

// Composite detail types (Phase A)
export interface StockDetail {
  ticker: string;
  company_name: string | null;
  sector: string | null;
  exchange: string | null;
  quote: StockQuote | null;
  signals: Signal[];
  sentiment_summary: SentimentSummary | null;
  recent_sentiment: SentimentPost[];
  backtest_results: BacktestResult[];
  related_articles: Article[];
}

export interface SignalDetail extends Signal {
  article: Article | null;
  stock_quote: StockQuote | null;
  backtest: BacktestResult | null;
  related_signals: Signal[];
}

export interface ThemeDetail extends Theme {
  articles: Article[];
  related_signals: Signal[];
}

export interface SearchResults {
  stocks: Top100Stock[];
  signals: Signal[];
  articles: Article[];
  themes: Theme[];
  query: string;
}

// Chat types (Phase B)
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  references: Array<{ type: string; id?: number; ticker?: string }>;
}

export interface ChatResponse {
  response: string;
  references: Array<{ type: string; id?: number; ticker?: string }>;
  suggested_queries: string[];
}

// Top Picks (Insights)
export interface TopPick {
  ticker: string;
  stock_name: string | null;
  sector: string | null;
  direction: string;
  composite_score: number;
  signal_confidence: number;
  backtest_accuracy_7d: number | null;
  sentiment_score: number;
  signal_count: number;
  reasoning: string | null;
  impact_hypothesis: string | null;
  time_horizon: string | null;
  latest_signal_id: number;
  current_price: number | null;
  percent_change: number | null;
}

// Enhanced dashboard types (Phase C)
export interface SectorHeatmapEntry {
  sector: string;
  signal_count: number;
  avg_sentiment_score: number;
  avg_price_change: number | null;
  top_ticker: string | null;
  accuracy: number | null;
}

export interface PipelineStats {
  total_sources: number;
  articles_ingested_today: number;
  articles_processed_today: number;
  signals_generated_today: number;
  backtests_run_today: number;
  sentiment_posts_today: number;
  last_ingestion_time: string | null;
}

export interface EnhancedDashboard extends DashboardSummary {
  overall_sentiment_trend: string;
  sentiment_change_vs_yesterday: number | null;
  sector_heatmap: SectorHeatmapEntry[];
  pipeline_stats: PipelineStats;
}

// ──────────────────────────────────────────────────────────────
// MiroFish Integration Types
// ──────────────────────────────────────────────────────────────

export interface GraphNode {
  uuid: string;
  name: string;
  labels?: string[];
  summary?: string;
  attributes?: Record<string, string>;
  created_at?: string;
  financial_data?: { current_price?: number; percent_change?: number; volume?: number };
  signal_data?: { total: number; positive: number; negative: number };
  sector?: string;
}

export interface GraphEdge {
  uuid: string;
  name: string;
  fact?: string;
  fact_type?: string;
  source_node_uuid: string;
  target_node_uuid: string;
  source_name?: string;
  target_name?: string;
  created_at?: string;
  episodes?: string[];
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  node_count: number;
  edge_count: number;
  graph_id?: string;
  built_at?: string;
  status?: string;
  message?: string;
}

export interface ConsensusResult {
  id: number;
  signal_id: number;
  consensus_score: number;
  agreement_ratio: number;
  bull_count: number;
  bear_count: number;
  neutral_count: number;
  debate_summary: string | null;
  key_arguments_bull: string[];
  key_arguments_bear: string[];
  created_at: string | null;
}

export interface ScenarioImpact {
  id: number;
  ticker: string;
  predicted_direction: string | null;
  predicted_magnitude: number | null;
  confidence: number | null;
  sentiment_shift: number | null;
  reasoning: string | null;
}

export interface ScenarioHistory {
  id: number;
  scenario_description: string | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string | null;
  impact_count: number;
}

export interface TaskStatus {
  status: string;
  progress: number;
  message: string;
  error?: string;
  [key: string]: unknown;
}

export interface ReportListItem {
  id: number;
  simulation_type: string;
  report_id: string | null;
  scenario_description: string | null;
  status: string;
  completed_at: string | null;
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

  // Stock Detail (composite)
  getStockDetail: (ticker: string) =>
    fetchAPI<StockDetail>(`/api/stocks/${encodeURIComponent(ticker)}/detail`),

  // Signal Detail (composite)
  getSignalDetail: (id: number) =>
    fetchAPI<SignalDetail>(`/api/signals/${id}/detail`),

  // Theme Detail (with articles)
  getThemeDetail: (id: number) =>
    fetchAPI<ThemeDetail>(`/api/themes/${id}`),

  // Global Search
  search: (q: string, limit?: number) => {
    const params = new URLSearchParams({ q });
    if (limit) params.set("limit", String(limit));
    return fetchAPI<SearchResults>(`/api/search?${params.toString()}`);
  },

  // Chat
  chat: (message: string, conversationHistory: ChatMessage[]) =>
    fetchAPI<ChatResponse>("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message, conversation_history: conversationHistory }),
    }),
  getChatSuggestions: () =>
    fetchAPI<string[]>("/api/chat/suggestions"),

  // Enhanced Dashboard
  getEnhancedDashboard: () =>
    fetchAPI<EnhancedDashboard>("/api/dashboard/enhanced"),
  getMarketNarrative: () =>
    fetchAPI<{ narrative: string }>("/api/dashboard/narrative"),

  // Insights
  getTopPicks: (params?: { limit?: number; min_confidence?: number; time_horizon?: string; direction?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.min_confidence) searchParams.set("min_confidence", String(params.min_confidence));
    if (params?.time_horizon) searchParams.set("time_horizon", params.time_horizon);
    if (params?.direction) searchParams.set("direction", params.direction);
    const qs = searchParams.toString();
    return fetchAPI<TopPick[]>(`/api/insights/top-picks${qs ? `?${qs}` : ""}`);
  },

  // ── Knowledge Graph ──────────────────────────────────────
  buildKnowledgeGraph: () =>
    fetchAPI<{ task_id: string; status: string }>("/api/knowledge-graph/build", { method: "POST" }),
  getKGBuildStatus: (taskId?: string) =>
    fetchAPI<TaskStatus>(taskId ? `/api/knowledge-graph/status/${taskId}` : "/api/knowledge-graph/status"),
  getGraphData: (params?: { sector?: string; ticker?: string }) => {
    const sp = new URLSearchParams();
    if (params?.sector) sp.set("sector", params.sector);
    if (params?.ticker) sp.set("ticker", params.ticker);
    const qs = sp.toString();
    return fetchAPI<GraphData>(`/api/knowledge-graph/data${qs ? `?${qs}` : ""}`);
  },
  searchGraph: (q: string) =>
    fetchAPI<{ results: GraphNode[] }>(`/api/knowledge-graph/search?q=${encodeURIComponent(q)}`),

  // ── Consensus ────────────────────────────────────────────
  runConsensus: (signalId: number) =>
    fetchAPI<{ task_id: string; status: string }>("/api/consensus/run", {
      method: "POST",
      body: JSON.stringify({ signal_id: signalId }),
    }),
  getConsensusStatus: (taskId: string) =>
    fetchAPI<TaskStatus>(`/api/consensus/status/${taskId}`),
  getConsensus: (signalId: number) =>
    fetchAPI<ConsensusResult>(`/api/consensus/${signalId}`),

  // ── Scenarios ────────────────────────────────────────────
  runScenario: (scenarioText: string, targetTickers?: string[], sectors?: string[], maxRounds?: number) =>
    fetchAPI<{ task_id: string; status: string }>("/api/scenarios/run", {
      method: "POST",
      body: JSON.stringify({
        scenario_text: scenarioText,
        target_tickers: targetTickers,
        sectors,
        max_rounds: maxRounds || 15,
      }),
    }),
  getScenarioStatus: (taskId: string) =>
    fetchAPI<TaskStatus>(`/api/scenarios/status/${taskId}`),
  getScenarioHistory: (limit?: number) =>
    fetchAPI<ScenarioHistory[]>(`/api/scenarios/history${limit ? `?limit=${limit}` : ""}`),
  getScenario: (id: number) =>
    fetchAPI<Record<string, unknown>>(`/api/scenarios/${id}`),
  getScenarioImpacts: (id: number) =>
    fetchAPI<ScenarioImpact[]>(`/api/scenarios/${id}/impacts`),

  // ── Reports ──────────────────────────────────────────────
  generateReport: (simulationId: number) =>
    fetchAPI<{ status: string; report_id: string }>("/api/reports/generate", {
      method: "POST",
      body: JSON.stringify({ simulation_id: simulationId }),
    }),
  getReport: (reportId: string) =>
    fetchAPI<Record<string, unknown>>(`/api/reports/${reportId}`),
  getReportProgress: (reportId: string) =>
    fetchAPI<TaskStatus>(`/api/reports/${reportId}/progress`),
  listReports: (limit?: number) =>
    fetchAPI<ReportListItem[]>(`/api/reports/list${limit ? `?limit=${limit}` : ""}`),
  chatWithReport: (reportId: string, message: string, history?: Array<{ role: string; content: string }>) =>
    fetchAPI<{ response: string }>("/api/reports/chat", {
      method: "POST",
      body: JSON.stringify({ report_id: reportId, message, history }),
    }),
};
