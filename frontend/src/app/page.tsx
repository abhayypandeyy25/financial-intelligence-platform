"use client";

import { useEffect, useState } from "react";
import { api, DashboardSummary, StockQuote, SentimentPost } from "@/lib/api";
import StatCard from "@/components/StatCard";
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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [topMovers, setTopMovers] = useState<StockQuote[]>([]);
  const [recentPosts, setRecentPosts] = useState<SentimentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.getDashboard(),
      api.getStockQuotes({ limit: 100 }).catch(() => [] as StockQuote[]),
      api.getSentiment({ days: 3, limit: 5 }).catch(() => [] as SentimentPost[]),
    ])
      .then(([dashData, quotes, posts]) => {
        setData(dashData);
        // Sort by absolute percent change to get top movers
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
          Financial Intelligence Platform - Canadian Market (TSX) Pilot
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Articles" value={data.total_articles} color="blue" />
        <StatCard title="Total Signals" value={data.total_signals} subtitle={`${data.signals_today} today`} color="emerald" />
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latest Signals */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-4">Latest Signals</h2>
          {data.latest_signals.length === 0 ? (
            <p className="text-slate-500 text-sm">No signals yet. Run the seed script or trigger ingestion.</p>
          ) : (
            <div className="space-y-3">
              {data.latest_signals.map((signal: any) => (
                <div
                  key={signal.id}
                  className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-emerald-400">
                        {signal.ticker}
                      </span>
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
                </div>
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

      {/* Signals by Sector */}
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

      {/* Market Overview + Community Buzz */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Movers */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-4">Top Movers</h2>
          {topMovers.length === 0 ? (
            <p className="text-slate-500 text-sm">No stock quote data yet. Go to Stocks page and click Refresh Quotes.</p>
          ) : (
            <div className="space-y-2">
              {topMovers.map((q) => (
                <div
                  key={q.ticker}
                  className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
                >
                  <div>
                    <span className="font-mono text-sm font-semibold text-emerald-400">
                      {q.ticker.replace(".TO", "")}
                    </span>
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
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Community Buzz */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-4">Community Buzz</h2>
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
