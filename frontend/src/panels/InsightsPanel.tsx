"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  EnhancedDashboard,
  BacktestSummary,
  BacktestResult,
  TopPick,
  Top100Stock,
  StockQuote,
  SentimentPost,
  Theme,
} from "@/lib/api";
import StatCard from "@/components/StatCard";
import SectorHeatmap from "@/components/SectorHeatmap";
import MarketNarrative from "@/components/MarketNarrative";
import TickerLink from "@/components/TickerLink";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
  ReferenceLine,
  Legend,
} from "recharts";

const SECTOR_COLORS: Record<string, string> = {
  Finance: "bg-blue-50 text-blue-600",
  Energy: "bg-amber-50 text-amber-600",
  Mining: "bg-purple-50 text-purple-600",
  Technology: "bg-emerald-50 text-emerald-600",
  Healthcare: "bg-red-50 text-red-600",
  Other: "bg-gray-100 text-gray-500",
};

const SENTIMENT_PIE_COLORS = ["#10b981", "#ef4444", "#f59e0b"];

const SECTIONS = [
  { id: "pulse", label: "Pulse" },
  { id: "picks", label: "Top Picks" },
  { id: "sectors", label: "Sectors" },
  { id: "reliability", label: "Reliability" },
  { id: "sentiment", label: "Sentiment" },
  { id: "themes", label: "Themes" },
  { id: "screener", label: "Screener" },
];

function getSentimentGaugeValue(trend: string, heatmap: EnhancedDashboard["sector_heatmap"]): number {
  if (heatmap.length > 0) {
    const avg = heatmap.reduce((sum, s) => sum + s.avg_sentiment_score, 0) / heatmap.length;
    return Math.round(((avg + 1) / 2) * 100);
  }
  switch (trend) {
    case "bullish": return 80;
    case "bearish": return 20;
    case "mixed": return 45;
    default: return 50;
  }
}

function getSentimentGaugeColor(value: number): string {
  if (value >= 60) return "#10b981";
  if (value >= 40) return "#f59e0b";
  return "#ef4444";
}

function getSentimentLabel(trend: string): string {
  return trend.charAt(0).toUpperCase() + trend.slice(1);
}

function formatTimeAgo(iso: string | null): string {
  if (!iso) return "N/A";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function parseTickers(tickersJson: string | null): string[] {
  if (!tickersJson) return [];
  try { return JSON.parse(tickersJson); } catch { return []; }
}

export default function InsightsPanel() {
  const router = useRouter();

  // Tier 1 state (above the fold)
  const [enhanced, setEnhanced] = useState<EnhancedDashboard | null>(null);
  const [backtestSummary, setBacktestSummary] = useState<BacktestSummary | null>(null);
  const [topPicks, setTopPicks] = useState<TopPick[]>([]);
  const [loadingT1, setLoadingT1] = useState(true);

  // Tier 2 state (below the fold)
  const [backtestResults, setBacktestResults] = useState<BacktestResult[]>([]);
  const [stocks, setStocks] = useState<Top100Stock[]>([]);
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [posts, setPosts] = useState<SentimentPost[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loadingT2, setLoadingT2] = useState(true);

  // UI state
  const [activeSection, setActiveSection] = useState("pulse");
  const [horizonFilter, setHorizonFilter] = useState<string>("all");
  const [themeDays, setThemeDays] = useState(7);
  const [showBacktestDetails, setShowBacktestDetails] = useState(false);
  const [showScreener, setShowScreener] = useState(false);
  const [showAllPosts, setShowAllPosts] = useState(false);
  const [sentimentFilter, setSentimentFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sectorFilter, setSectorFilter] = useState("");
  const [running, setRunning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Tier 1 fetch
  useEffect(() => {
    Promise.all([
      api.getEnhancedDashboard().catch(() => null),
      api.getBacktestSummary().catch(() => null),
      api.getTopPicks().catch(() => []),
    ]).then(([e, bs, tp]) => {
      setEnhanced(e);
      setBacktestSummary(bs);
      setTopPicks(tp as TopPick[]);
    }).finally(() => setLoadingT1(false));
  }, []);

  // Tier 2 fetch (after Tier 1)
  useEffect(() => {
    if (loadingT1) return;
    Promise.all([
      api.getBacktestResults().catch(() => []),
      api.getTop100Stocks().catch(() => []),
      api.getStockQuotes({ limit: 200 }).catch(() => []),
      api.getSentiment({ days: 7, limit: 50 }).catch(() => []),
      api.getThemes(themeDays).catch(() => []),
    ]).then(([br, st, q, p, th]) => {
      setBacktestResults(br as BacktestResult[]);
      setStocks(st as Top100Stock[]);
      const quoteMap: Record<string, StockQuote> = {};
      for (const quote of q as StockQuote[]) {
        const existing = quoteMap[quote.ticker];
        if (!existing || (quote.ingested_at && existing.ingested_at && quote.ingested_at > existing.ingested_at)) {
          quoteMap[quote.ticker] = quote;
        }
      }
      setQuotes(quoteMap);
      setPosts(p as SentimentPost[]);
      setThemes(th as Theme[]);
    }).finally(() => setLoadingT2(false));
  }, [loadingT1, themeDays]);

  // Scroll to section
  const scrollToSection = (id: string) => {
    setActiveSection(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Computed: sector accuracy data
  const sectorAccuracyData = useMemo(() => {
    if (!backtestSummary) return [];
    return Object.entries(backtestSummary.by_sector).map(([sector, data]) => ({
      sector,
      accuracy_1d: data.accuracy_1d || 0,
      accuracy_7d: data.accuracy_7d || 0,
      total: data.total || 0,
    }));
  }, [backtestSummary]);

  // Computed: weekly accuracy trend
  const weeklyAccuracy = useMemo(() => {
    if (backtestResults.length === 0) return [];
    const sorted = [...backtestResults].sort(
      (a, b) => new Date(a.signal_date).getTime() - new Date(b.signal_date).getTime()
    );
    const buckets: Record<string, { acc1d: boolean[]; acc7d: boolean[] }> = {};
    for (const r of sorted) {
      const d = new Date(r.signal_date);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().slice(0, 10);
      if (!buckets[key]) buckets[key] = { acc1d: [], acc7d: [] };
      if (r.accurate_1d != null) buckets[key].acc1d.push(r.accurate_1d);
      if (r.accurate_7d != null) buckets[key].acc7d.push(r.accurate_7d);
    }
    return Object.entries(buckets).map(([week, { acc1d, acc7d }]) => ({
      week: new Date(week).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      accuracy_1d: acc1d.length ? Math.round((acc1d.filter(Boolean).length / acc1d.length) * 100) : null,
      accuracy_7d: acc7d.length ? Math.round((acc7d.filter(Boolean).length / acc7d.length) * 100) : null,
      count: acc1d.length + acc7d.length,
    }));
  }, [backtestResults]);

  // Computed: sentiment breakdown for donut
  const sentimentDonutData = useMemo(() => {
    if (!enhanced) return [];
    const { signals_by_sentiment } = enhanced;
    const pos = signals_by_sentiment.positive || 0;
    const neg = signals_by_sentiment.negative || 0;
    const neu = signals_by_sentiment.neutral || 0;
    const total = pos + neg + neu;
    if (total === 0) return [];
    return [
      { name: "Positive", value: pos, pct: Math.round((pos / total) * 100) },
      { name: "Negative", value: neg, pct: Math.round((neg / total) * 100) },
      { name: "Neutral", value: neu, pct: Math.round((neu / total) * 100) },
    ];
  }, [enhanced]);

  // Computed: sentiment divergence (AI vs community)
  const sentimentDivergence = useMemo(() => {
    if (!enhanced || posts.length === 0) return null;
    const { signals_by_sentiment } = enhanced;
    const aiTotal = (signals_by_sentiment.positive || 0) + (signals_by_sentiment.negative || 0) + (signals_by_sentiment.neutral || 0);
    const aiPosPct = aiTotal > 0 ? Math.round(((signals_by_sentiment.positive || 0) / aiTotal) * 100) : 0;

    const processedPosts = posts.filter(p => p.sentiment);
    const comPos = processedPosts.filter(p => p.sentiment === "positive").length;
    const comTotal = processedPosts.length;
    const comPosPct = comTotal > 0 ? Math.round((comPos / comTotal) * 100) : 0;

    return { aiPosPct, comPosPct, divergence: aiPosPct - comPosPct };
  }, [enhanced, posts]);

  // Filtered picks by horizon
  const filteredPicks = useMemo(() => {
    if (horizonFilter === "all") return topPicks;
    return topPicks.filter(p => p.time_horizon === horizonFilter);
  }, [topPicks, horizonFilter]);

  // Filtered stocks
  const sectors = useMemo(() => Array.from(new Set(stocks.map(s => s.sector).filter(Boolean))) as string[], [stocks]);
  const filteredStocks = useMemo(() => {
    return stocks.filter(s => {
      if (sectorFilter && s.sector !== sectorFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return s.ticker.toLowerCase().includes(term) || s.company_name.toLowerCase().includes(term);
      }
      return true;
    });
  }, [stocks, sectorFilter, searchTerm]);

  // Filtered posts
  const filteredPosts = useMemo(() => {
    const sorted = [...posts].sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
    const filtered = sentimentFilter ? sorted.filter(p => p.sentiment === sentimentFilter) : sorted;
    return showAllPosts ? filtered : filtered.slice(0, 5);
  }, [posts, sentimentFilter, showAllPosts]);

  // Actions
  const handleRunBacktest = async () => {
    setRunning(true);
    try {
      const result = await api.runBacktest();
      alert(`Tested ${result.signals_tested} signals, created ${result.results_created} results`);
      const [bs, br] = await Promise.all([api.getBacktestSummary(), api.getBacktestResults()]);
      setBacktestSummary(bs);
      setBacktestResults(br);
    } catch { alert("Back-test failed."); }
    setRunning(false);
  };

  const handleRefreshStocks = async () => {
    setRefreshing(true);
    try {
      await api.refreshStockQuotes();
      const quotesData = await api.getStockQuotes({ limit: 200 });
      const quoteMap: Record<string, StockQuote> = {};
      for (const q of quotesData) {
        const existing = quoteMap[q.ticker];
        if (!existing || (q.ingested_at && existing.ingested_at && q.ingested_at > existing.ingested_at)) {
          quoteMap[q.ticker] = q;
        }
      }
      setQuotes(quoteMap);
    } catch { alert("Refresh failed."); }
    setRefreshing(false);
  };

  // Loading state
  if (loadingT1) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-6 pb-24 lg:pb-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64" />
          <div className="h-4 bg-gray-100 rounded w-96" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
          </div>
          <div className="h-48 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  const gaugeValue = enhanced ? getSentimentGaugeValue(enhanced.overall_sentiment_trend, enhanced.sector_heatmap) : 50;
  const gaugeColor = getSentimentGaugeColor(gaugeValue);
  const gaugeData = [{ value: gaugeValue, fill: gaugeColor }];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 pb-24 lg:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Market Intelligence</h1>
          <p className="text-gray-500 text-sm mt-1">
            AI-powered investment dashboard for TSX
            {enhanced?.pipeline_stats.last_ingestion_time && (
              <span className="ml-2 text-gray-400">
                Updated {formatTimeAgo(enhanced.pipeline_stats.last_ingestion_time)}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleRunBacktest}
          disabled={running}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg text-sm font-medium transition-colors w-fit"
        >
          {running ? "Running..." : "Run Back-tests"}
        </button>
      </div>

      {/* Sticky Section Nav */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-100 -mx-6 px-6 py-2">
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => scrollToSection(s.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeSection === s.id
                  ? "bg-emerald-100 text-emerald-700"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ========== SECTION 1: MARKET PULSE ========== */}
      <div ref={el => { sectionRefs.current["pulse"] = el; }} className="space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* AI Briefing (left 3 cols) */}
          <div className="lg:col-span-3">
            <MarketNarrative />
          </div>

          {/* Sentiment Gauge + Pipeline (right 2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            {/* Gauge */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Market Mood</p>
              <div className="w-full h-36 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    cx="50%"
                    cy="80%"
                    innerRadius="60%"
                    outerRadius="90%"
                    startAngle={180}
                    endAngle={0}
                    data={gaugeData}
                    barSize={12}
                  >
                    <RadialBar
                      dataKey="value"
                      cornerRadius={6}
                      background={{ fill: "#f3f4f6" }}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
                  <span className="text-lg font-bold" style={{ color: gaugeColor }}>
                    {enhanced ? getSentimentLabel(enhanced.overall_sentiment_trend) : "—"}
                  </span>
                  {enhanced?.sentiment_change_vs_yesterday != null && (
                    <span className={`text-xs font-medium ${enhanced.sentiment_change_vs_yesterday >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {enhanced.sentiment_change_vs_yesterday >= 0 ? "+" : ""}
                      {enhanced.sentiment_change_vs_yesterday}pp vs yesterday
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Pipeline Activity */}
            {enhanced && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Today&apos;s Pipeline</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-gray-900">{enhanced.pipeline_stats.articles_ingested_today}</p>
                    <p className="text-xs text-gray-400">Articles</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900">{enhanced.pipeline_stats.signals_generated_today}</p>
                    <p className="text-xs text-gray-400">Signals</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900">{enhanced.pipeline_stats.backtests_run_today}</p>
                    <p className="text-xs text-gray-400">Backtests</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Accuracy KPIs */}
        {backtestSummary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="1-Day Accuracy"
              value={backtestSummary.accuracy_1d ? `${backtestSummary.accuracy_1d}%` : "N/A"}
              color="emerald"
              trend={backtestSummary.accuracy_1d ? (backtestSummary.accuracy_1d >= 60 ? "up" : "down") : undefined}
            />
            <StatCard
              title="7-Day Accuracy"
              value={backtestSummary.accuracy_7d ? `${backtestSummary.accuracy_7d}%` : "N/A"}
              color="amber"
              trend={backtestSummary.accuracy_7d ? (backtestSummary.accuracy_7d >= 60 ? "up" : "down") : undefined}
            />
            <StatCard
              title="30-Day Accuracy"
              value={backtestSummary.accuracy_30d ? `${backtestSummary.accuracy_30d}%` : "N/A"}
              color="blue"
              trend={backtestSummary.accuracy_30d ? (backtestSummary.accuracy_30d >= 60 ? "up" : "down") : undefined}
            />
            <StatCard
              title="Avg Confidence"
              value={backtestSummary.avg_confidence ? `${(backtestSummary.avg_confidence * 100).toFixed(0)}%` : "N/A"}
              color="purple"
            />
          </div>
        )}
      </div>

      {/* ========== SECTION 2: TOP PICKS ========== */}
      <div ref={el => { sectionRefs.current["picks"] = el; }} className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Top Investment Picks</h2>
            <p className="text-sm text-gray-500">AI-ranked opportunities backed by signals + backtests</p>
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {[
              { id: "all", label: "All" },
              { id: "short", label: "Short" },
              { id: "medium", label: "Medium" },
            ].map(h => (
              <button
                key={h.id}
                onClick={() => setHorizonFilter(h.id)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  horizonFilter === h.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>

        {filteredPicks.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-gray-400">No high-confidence signals found. Try running signal extraction first.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPicks.map((pick, idx) => (
              <div
                key={pick.ticker}
                className="bg-white border border-gray-200 rounded-xl p-5 hover:border-emerald-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-start gap-4">
                  {/* Rank */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                    idx < 3 ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    #{idx + 1}
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <TickerLink ticker={pick.ticker} />
                      {pick.stock_name && (
                        <span className="text-sm text-gray-500">{pick.stock_name}</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        pick.direction === "up" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      }`}>
                        {pick.direction.toUpperCase()}
                      </span>
                      {pick.sector && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${SECTOR_COLORS[pick.sector] || SECTOR_COLORS.Other}`}>
                          {pick.sector}
                        </span>
                      )}
                    </div>

                    {/* Metric badges */}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-xs text-gray-500">
                        Conf: <span className="font-semibold text-gray-700">{(pick.signal_confidence * 100).toFixed(0)}%</span>
                      </span>
                      <span className="text-xs text-gray-500">
                        7D Acc: <span className="font-semibold text-gray-700">{pick.backtest_accuracy_7d != null ? `${pick.backtest_accuracy_7d}%` : "—"}</span>
                      </span>
                      <span className="text-xs text-gray-500">
                        Sentiment: <span className={`font-semibold ${pick.sentiment_score >= 0.15 ? "text-emerald-600" : pick.sentiment_score <= -0.15 ? "text-red-600" : "text-amber-600"}`}>
                          {pick.sentiment_score >= 0.15 ? "Bullish" : pick.sentiment_score <= -0.15 ? "Bearish" : "Neutral"}
                        </span>
                      </span>
                      {pick.signal_count > 1 && (
                        <span className="text-xs text-gray-400">{pick.signal_count} signals</span>
                      )}
                      {pick.current_price != null && (
                        <span className="text-xs text-gray-500">
                          ${pick.current_price.toFixed(2)}
                          {pick.percent_change != null && (
                            <span className={pick.percent_change >= 0 ? "text-emerald-600 ml-1" : "text-red-600 ml-1"}>
                              {pick.percent_change >= 0 ? "+" : ""}{pick.percent_change.toFixed(2)}%
                            </span>
                          )}
                        </span>
                      )}
                    </div>

                    {/* Reasoning */}
                    {pick.impact_hypothesis && (
                      <p className="text-xs text-gray-500 mt-2 line-clamp-2">{pick.impact_hypothesis}</p>
                    )}
                  </div>

                  {/* Composite Score */}
                  <div className="text-right shrink-0">
                    <div className={`text-2xl font-bold ${
                      pick.composite_score >= 70 ? "text-emerald-600" : pick.composite_score >= 50 ? "text-amber-600" : "text-gray-500"
                    }`}>
                      {Math.round(pick.composite_score)}
                    </div>
                    <div className="text-xs text-gray-400">/ 100</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========== SECTION 3: SECTOR MOMENTUM ========== */}
      <div ref={el => { sectionRefs.current["sectors"] = el; }} className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Sector Momentum</h2>
          <p className="text-sm text-gray-500">Signal density and sentiment across TSX sectors</p>
        </div>

        {enhanced && <SectorHeatmap sectors={enhanced.sector_heatmap} />}

        {sectorAccuracyData.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Accuracy by Sector</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={sectorAccuracyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="sector" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                />
                <ReferenceLine y={50} stroke="#9ca3af" strokeDasharray="3 3" label={{ value: "Random", position: "left", fill: "#9ca3af", fontSize: 10 }} />
                <Bar dataKey="accuracy_1d" name="1-Day" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="accuracy_7d" name="7-Day" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ========== SECTION 4: SIGNAL RELIABILITY ========== */}
      <div ref={el => { sectionRefs.current["reliability"] = el; }} className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Signal Reliability</h2>
          <p className="text-sm text-gray-500">Accuracy trends and prediction confidence analysis</p>
        </div>

        {weeklyAccuracy.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Accuracy Trend Over Time</h3>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={weeklyAccuracy}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="week" stroke="#6b7280" fontSize={11} />
                <YAxis stroke="#6b7280" fontSize={11} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                />
                <ReferenceLine y={50} stroke="#9ca3af" strokeDasharray="3 3" />
                <Area type="monotone" dataKey="accuracy_1d" name="1-Day" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="accuracy_7d" name="7-Day" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} strokeWidth={2} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Collapsible Backtest Results Table */}
        <div className="bg-white border border-gray-200 rounded-xl">
          <button
            onClick={() => setShowBacktestDetails(!showBacktestDetails)}
            className="w-full flex items-center justify-between p-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors rounded-xl"
          >
            <span>Detailed Backtest Results ({backtestResults.length})</span>
            <svg className={`w-5 h-5 text-gray-400 transition-transform ${showBacktestDetails ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showBacktestDetails && (
            <div className="border-t border-gray-200 p-4 overflow-x-auto">
              {backtestResults.length === 0 ? (
                <p className="text-gray-400 text-sm">No back-test results yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500">
                      <th className="text-left py-2 px-3">Ticker</th>
                      <th className="text-left py-2 px-3">Predicted</th>
                      <th className="text-right py-2 px-3">Price</th>
                      <th className="text-right py-2 px-3">1D</th>
                      <th className="text-right py-2 px-3">7D</th>
                      <th className="text-right py-2 px-3">30D</th>
                      <th className="text-center py-2 px-3">1D</th>
                      <th className="text-center py-2 px-3">7D</th>
                      <th className="text-center py-2 px-3">30D</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backtestResults.map(r => (
                      <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3 font-mono font-semibold text-gray-900">{r.ticker}</td>
                        <td className="py-2 px-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${r.direction_predicted === "up" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                            {r.direction_predicted.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-gray-700">${r.price_at_signal?.toFixed(2)}</td>
                        <td className={`py-2 px-3 text-right ${(r.actual_1d_change ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {r.actual_1d_change != null ? `${r.actual_1d_change > 0 ? "+" : ""}${r.actual_1d_change.toFixed(2)}%` : "-"}
                        </td>
                        <td className={`py-2 px-3 text-right ${(r.actual_7d_change ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {r.actual_7d_change != null ? `${r.actual_7d_change > 0 ? "+" : ""}${r.actual_7d_change.toFixed(2)}%` : "-"}
                        </td>
                        <td className={`py-2 px-3 text-right ${(r.actual_30d_change ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {r.actual_30d_change != null ? `${r.actual_30d_change > 0 ? "+" : ""}${r.actual_30d_change.toFixed(2)}%` : "-"}
                        </td>
                        <td className="py-2 px-3 text-center">{r.accurate_1d != null ? (r.accurate_1d ? "✓" : "✗") : "-"}</td>
                        <td className="py-2 px-3 text-center">{r.accurate_7d != null ? (r.accurate_7d ? "✓" : "✗") : "-"}</td>
                        <td className="py-2 px-3 text-center">{r.accurate_30d != null ? (r.accurate_30d ? "✓" : "✗") : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ========== SECTION 5: SENTIMENT INTELLIGENCE ========== */}
      <div ref={el => { sectionRefs.current["sentiment"] = el; }} className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Sentiment Intelligence</h2>
          <p className="text-sm text-gray-500">AI-analyzed news sentiment vs community sentiment</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Sentiment Donut */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Signal Sentiment Breakdown</h3>
            {sentimentDonutData.length > 0 ? (
              <div className="flex items-center gap-4">
                <div className="w-40 h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sentimentDonutData}
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {sentimentDonutData.map((_, i) => (
                          <Cell key={i} fill={SENTIMENT_PIE_COLORS[i]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                        formatter={(value) => [`${value} signals`]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {sentimentDonutData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SENTIMENT_PIE_COLORS[i] }} />
                      <span className="text-sm text-gray-700">{d.name}</span>
                      <span className="text-sm font-semibold text-gray-900">{d.pct}%</span>
                    </div>
                  ))}
                  <div className="text-xs text-gray-400 mt-1">
                    Total: {sentimentDonutData.reduce((s, d) => s + d.value, 0)} signals
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-400 text-sm">No sentiment data available.</p>
            )}
          </div>

          {/* Divergence Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">News vs Community</h3>
            {sentimentDivergence ? (
              <div className="space-y-4">
                {/* AI Signals bar */}
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>AI Signals</span>
                    <span className="font-semibold text-gray-700">{sentimentDivergence.aiPosPct}% positive</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${sentimentDivergence.aiPosPct}%` }} />
                  </div>
                </div>

                {/* Community bar */}
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Reddit / Twitter</span>
                    <span className="font-semibold text-gray-700">{sentimentDivergence.comPosPct}% positive</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${sentimentDivergence.comPosPct}%` }} />
                  </div>
                </div>

                {/* Divergence */}
                <div className={`rounded-lg p-3 text-center ${
                  Math.abs(sentimentDivergence.divergence) > 15
                    ? "bg-amber-50 border border-amber-200"
                    : "bg-gray-50 border border-gray-200"
                }`}>
                  <span className="text-sm font-medium text-gray-700">
                    Divergence: <span className={sentimentDivergence.divergence >= 0 ? "text-emerald-600" : "text-red-600"}>
                      {sentimentDivergence.divergence >= 0 ? "+" : ""}{sentimentDivergence.divergence}pp
                    </span>
                  </span>
                  {Math.abs(sentimentDivergence.divergence) > 15 && (
                    <p className="text-xs text-amber-600 mt-1">
                      {sentimentDivergence.divergence > 0 ? "AI more bullish than community" : "Community more bullish than AI"}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-gray-400 text-sm">Need both AI signals and community posts to compare.</p>
            )}
          </div>
        </div>

        {/* Community Posts */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Community Voices</h3>
            <select
              value={sentimentFilter}
              onChange={(e) => setSentimentFilter(e.target.value)}
              className="bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-700"
            >
              <option value="">All</option>
              <option value="positive">Positive</option>
              <option value="negative">Negative</option>
              <option value="neutral">Neutral</option>
            </select>
          </div>

          {filteredPosts.length === 0 ? (
            <p className="text-gray-400 text-sm">No community posts found.</p>
          ) : (
            <>
              {filteredPosts.map(post => {
                const tickers = parseTickers(post.tickers_mentioned);
                const sentColor =
                  post.sentiment === "positive" ? "bg-emerald-100 text-emerald-700" :
                  post.sentiment === "negative" ? "bg-red-100 text-red-700" :
                  post.sentiment === "neutral" ? "bg-amber-100 text-amber-700" :
                  "bg-gray-100 text-gray-500";
                return (
                  <div key={post.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 line-clamp-2">{post.content}</p>
                        {tickers.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {tickers.map(t => (
                              <span key={t} className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-mono">{t}</span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                          <span className="bg-gray-100 px-1.5 py-0.5 rounded">{post.source}</span>
                          <span>{post.upvotes} upvotes</span>
                          <span>{post.comments_count} comments</span>
                        </div>
                      </div>
                      {post.sentiment && (
                        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${sentColor}`}>{post.sentiment}</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {posts.length > 5 && (
                <button
                  onClick={() => setShowAllPosts(!showAllPosts)}
                  className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  {showAllPosts ? "Show less" : `Show all ${posts.length} posts`}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ========== SECTION 6: EMERGING THEMES ========== */}
      <div ref={el => { sectionRefs.current["themes"] = el; }} className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Emerging Themes</h2>
            <p className="text-sm text-gray-500">Active investment narratives detected by AI</p>
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {[7, 30].map(d => (
              <button
                key={d}
                onClick={() => setThemeDays(d)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  themeDays === d ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {d} days
              </button>
            ))}
          </div>
        </div>

        {loadingT2 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : themes.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-gray-400">No themes detected in the last {themeDays} days.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {themes.map(theme => {
              const relevance = theme.relevance_score ? Math.round(theme.relevance_score * 100) : 0;
              const relColor = relevance >= 70 ? "bg-emerald-500" : relevance >= 50 ? "bg-amber-500" : "bg-gray-400";
              return (
                <div
                  key={theme.id}
                  onClick={() => router.push(`/themes/${theme.id}`)}
                  className="bg-white border border-gray-200 rounded-xl p-5 hover:border-emerald-200 hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-sm">{theme.name}</h3>
                      {theme.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{theme.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-3">
                        {theme.sector && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${SECTOR_COLORS[theme.sector] || SECTOR_COLORS.Other}`}>
                            {theme.sector}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">{theme.article_count} articles</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-gray-700">{relevance}%</div>
                      <div className="text-xs text-gray-400">relevance</div>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${relColor}`} style={{ width: `${relevance}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========== SECTION 7: STOCK SCREENER ========== */}
      <div ref={el => { sectionRefs.current["screener"] = el; }}>
        <div className="bg-white border border-gray-200 rounded-xl">
          <button
            onClick={() => setShowScreener(!showScreener)}
            className="w-full flex items-center justify-between p-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors rounded-xl"
          >
            <div>
              <span className="text-lg font-semibold text-gray-900">Stock Screener</span>
              <span className="text-gray-400 text-sm ml-2">TSX Top 100</span>
            </div>
            <svg className={`w-5 h-5 text-gray-400 transition-transform ${showScreener ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showScreener && (
            <div className="border-t border-gray-200 p-4 space-y-4">
              <div className="flex flex-wrap gap-3 items-center">
                <input
                  type="text"
                  placeholder="Search ticker or company..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 flex-1 min-w-[200px]"
                />
                <select
                  value={sectorFilter}
                  onChange={(e) => setSectorFilter(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                >
                  <option value="">All Sectors</option>
                  {sectors.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button
                  onClick={handleRefreshStocks}
                  disabled={refreshing}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {refreshing ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wider">
                      <th className="px-3 py-2">Rank</th>
                      <th className="px-3 py-2">Ticker</th>
                      <th className="px-3 py-2">Company</th>
                      <th className="px-3 py-2">Sector</th>
                      <th className="px-3 py-2 text-right">Price</th>
                      <th className="px-3 py-2 text-right">Change</th>
                      <th className="px-3 py-2 text-right">% Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStocks.length === 0 ? (
                      <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">No stocks found.</td></tr>
                    ) : filteredStocks.map(stock => {
                      const quote = quotes[stock.ticker];
                      const changeColor = quote?.percent_change && quote.percent_change > 0 ? "text-emerald-600" :
                        quote?.percent_change && quote.percent_change < 0 ? "text-red-600" : "text-gray-500";
                      return (
                        <tr
                          key={stock.ticker}
                          onClick={() => router.push(`/stocks/${stock.ticker}`)}
                          className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          <td className="px-3 py-2 text-sm text-gray-400">{stock.market_cap_rank}</td>
                          <td className="px-3 py-2">
                            <span className="font-mono text-sm font-semibold text-emerald-600">{stock.ticker.replace(".TO", "")}</span>
                            <span className="text-gray-400 text-xs ml-0.5">.TO</span>
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-700">{stock.company_name}</td>
                          <td className="px-3 py-2">
                            {stock.sector && (
                              <span className={`text-xs px-2 py-0.5 rounded-full ${SECTOR_COLORS[stock.sector] || SECTOR_COLORS.Other}`}>{stock.sector}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-sm font-mono text-gray-900">
                            {quote?.current_price ? `$${quote.current_price.toFixed(2)}` : "--"}
                          </td>
                          <td className={`px-3 py-2 text-right text-sm font-mono ${changeColor}`}>
                            {quote?.price_change != null ? `${quote.price_change > 0 ? "+" : ""}${quote.price_change.toFixed(2)}` : "--"}
                          </td>
                          <td className={`px-3 py-2 text-right text-sm font-mono font-semibold ${changeColor}`}>
                            {quote?.percent_change != null ? `${quote.percent_change > 0 ? "+" : ""}${quote.percent_change.toFixed(2)}%` : "--"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
