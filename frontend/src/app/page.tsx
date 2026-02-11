"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, EnhancedDashboard, StockQuote, SentimentPost } from "@/lib/api";
import StatCard from "@/components/StatCard";
import MarketNarrative from "@/components/MarketNarrative";
import SectorHeatmap from "@/components/SectorHeatmap";
import PipelineFlow from "@/components/PipelineFlow";
import TickerLink from "@/components/TickerLink";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "#10b981",
  negative: "#ef4444",
  neutral: "#f59e0b",
};

const TREND_LABELS: Record<string, { text: string; color: string }> = {
  bullish: { text: "Bullish", color: "text-emerald-400" },
  bearish: { text: "Bearish", color: "text-red-400" },
  mixed: { text: "Mixed", color: "text-amber-400" },
  neutral: { text: "Neutral", color: "text-slate-400" },
};

export default function DashboardPage() {
  const [data, setData] = useState<EnhancedDashboard | null>(null);
  const [topMovers, setTopMovers] = useState<StockQuote[]>([]);
  const [recentPosts, setRecentPosts] = useState<SentimentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.getEnhancedDashboard().catch(() => null),
      api.getStockQuotes({ limit: 100 }).catch(() => [] as StockQuote[]),
      api.getSentiment({ days: 3, limit: 5 }).catch(() => [] as SentimentPost[]),
    ])
      .then(([dashData, quotes, posts]) => {
        if (!dashData) {
          // Fallback to basic dashboard if enhanced fails
          api
            .getDashboard()
            .then((basic) => {
              setData({
                ...basic,
                overall_sentiment_trend: "neutral",
                sentiment_change_vs_yesterday: null,
                sector_heatmap: [],
                pipeline_stats: {
                  total_sources: 0,
                  articles_ingested_today: 0,
                  articles_processed_today: 0,
                  signals_generated_today: 0,
                  backtests_run_today: 0,
                  sentiment_posts_today: 0,
                  last_ingestion_time: null,
                },
              } as EnhancedDashboard);
            })
            .catch((e) => setError(e.message));
        } else {
          setData(dashData);
        }
        const sorted = [...quotes]
          .filter((q) => q.percent_change != null)
          .sort((a, b) => Math.abs(b.percent_change || 0) - Math.abs(a.percent_change || 0));
        setTopMovers(sorted.slice(0, 6));
        setRecentPosts(posts);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
        <h2 className="text-red-400 font-semibold">Connection Error</h2>
        <p className="text-slate-400 mt-1 text-sm">
          Could not connect to the backend API. Make sure the FastAPI server is running on port 8000.
        </p>
        <code className="text-xs text-slate-500 mt-2 block">cd backend && uvicorn app.main:app --reload</code>
      </div>
    );
  }

  if (!data) return null;

  const trend = TREND_LABELS[data.overall_sentiment_trend] || TREND_LABELS.neutral;

  const sentimentData = Object.entries(data.signals_by_sentiment).map(([name, value]) => ({
    name,
    value,
  }));

  const sectorData = Object.entries(data.signals_by_sector).map(([name, value]) => ({
    name,
    signals: value,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">
          Financial Intelligence Platform — Canadian Market (TSX) Pilot
        </p>
      </div>

      {/* 1. AI Market Narrative */}
      <MarketNarrative />

      {/* 2. Market Pulse Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard title="Total Articles" value={data.total_articles} color="blue" />
        <StatCard
          title="Total Signals"
          value={data.total_signals}
          subtitle={`${data.signals_today} today`}
          color="emerald"
        />
        <StatCard
          title="1-Day Accuracy"
          value={data.accuracy_1d ? `${data.accuracy_1d}%` : "N/A"}
          color="amber"
        />
        <StatCard
          title="7-Day Accuracy"
          value={data.accuracy_7d ? `${data.accuracy_7d}%` : "N/A"}
          color="purple"
        />
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-center items-center">
          <div className="text-xs text-slate-500 mb-1">Market Sentiment</div>
          <div className={`text-xl font-bold ${trend.color}`}>{trend.text}</div>
          {data.sentiment_change_vs_yesterday != null && (
            <div
              className={`text-xs mt-1 ${
                data.sentiment_change_vs_yesterday >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {data.sentiment_change_vs_yesterday >= 0 ? "+" : ""}
              {data.sentiment_change_vs_yesterday}% vs yesterday
            </div>
          )}
        </div>
      </div>

      {/* 3. Sector Heatmap */}
      <SectorHeatmap sectors={data.sector_heatmap} />

      {/* 4. Pipeline Flow */}
      <PipelineFlow
        stats={data.pipeline_stats}
        totalArticles={data.total_articles}
        totalSignals={data.total_signals}
        totalBacktests={data.total_backtests}
      />

      {/* 5. Top Signals + Sentiment Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latest Signals with cross-links */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Top Signals</h2>
            <Link href="/signals" className="text-xs text-emerald-400 hover:text-emerald-300">
              View all →
            </Link>
          </div>
          {data.latest_signals.length === 0 ? (
            <p className="text-slate-500 text-sm">No signals yet. Run the seed script or trigger ingestion.</p>
          ) : (
            <div className="space-y-3">
              {data.latest_signals.map((signal: any) => (
                <Link
                  key={signal.id}
                  href={`/signals/${signal.id}`}
                  className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors block"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <TickerLink ticker={signal.ticker} size="sm" />
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          signal.direction === "up"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {signal.direction?.toUpperCase()}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          signal.sentiment === "positive"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : signal.sentiment === "negative"
                            ? "bg-red-500/10 text-red-400"
                            : "bg-amber-500/10 text-amber-400"
                        }`}
                      >
                        {signal.sentiment}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                      {signal.reasoning}
                    </p>
                  </div>
                  <div className="text-right ml-3">
                    <div className="text-sm font-semibold">
                      {(signal.confidence * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs text-slate-500">confidence</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Sentiment Distribution */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-4">Sentiment Distribution</h2>
          {sentimentData.length === 0 ? (
            <p className="text-slate-500 text-sm">No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={sentimentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {sentimentData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={SENTIMENT_COLORS[entry.name] || "#6b7280"}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 6. Signals by Sector */}
      {sectorData.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-4">Signals by Sector</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sectorData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="signals" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 7. Top Movers + Community Buzz */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Movers */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Top Movers</h2>
            <Link href="/stocks" className="text-xs text-emerald-400 hover:text-emerald-300">
              View all →
            </Link>
          </div>
          {topMovers.length === 0 ? (
            <p className="text-slate-500 text-sm">No stock quote data yet. Go to Stocks page and click Refresh Quotes.</p>
          ) : (
            <div className="space-y-2">
              {topMovers.map((q) => (
                <Link
                  key={q.ticker}
                  href={`/stocks/${q.ticker}`}
                  className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors block"
                >
                  <div>
                    <TickerLink ticker={q.ticker} size="sm" />
                    <span className="text-xs text-slate-500 ml-2">
                      {q.company_name}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono">${q.current_price?.toFixed(2)}</div>
                    <div
                      className={`text-xs font-mono font-semibold ${
                        (q.percent_change || 0) > 0
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      {(q.percent_change || 0) > 0 ? "+" : ""}
                      {q.percent_change?.toFixed(2)}%
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Community Buzz */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Community Buzz</h2>
            <Link href="/sentiment" className="text-xs text-emerald-400 hover:text-emerald-300">
              View all →
            </Link>
          </div>
          {recentPosts.length === 0 ? (
            <p className="text-slate-500 text-sm">No sentiment data yet. Go to Sentiment page and click Scrape Reddit.</p>
          ) : (
            <div className="space-y-3">
              {recentPosts.map((post) => (
                <div
                  key={post.id}
                  className="p-3 bg-slate-800/50 rounded-lg"
                >
                  <p className="text-sm text-slate-200 line-clamp-2">
                    {post.content}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                    <span className="bg-slate-700 px-2 py-0.5 rounded">
                      {post.source}
                    </span>
                    <span>{post.upvotes} upvotes</span>
                    <span>{post.comments_count} comments</span>
                    {post.sentiment && (
                      <span
                        className={`px-2 py-0.5 rounded-full ${
                          post.sentiment === "positive"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : post.sentiment === "negative"
                            ? "bg-red-500/10 text-red-400"
                            : "bg-amber-500/10 text-amber-400"
                        }`}
                      >
                        {post.sentiment}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
