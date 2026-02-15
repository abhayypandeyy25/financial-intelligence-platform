"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  BacktestResult,
  BacktestSummary,
  Top100Stock,
  StockQuote,
  SentimentPost,
} from "@/lib/api";
import StatCard from "@/components/StatCard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Tab = "backtests" | "stocks" | "sentiment";

const SECTOR_COLORS: Record<string, string> = {
  Finance: "bg-blue-50 text-blue-600",
  Energy: "bg-amber-50 text-amber-600",
  Mining: "bg-purple-50 text-purple-600",
  Technology: "bg-emerald-50 text-emerald-600",
  Healthcare: "bg-red-50 text-red-600",
  Other: "bg-gray-100 text-gray-500",
};

export default function InsightsPanel() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("backtests");

  // Backtest state
  const [summary, setSummary] = useState<BacktestSummary | null>(null);
  const [results, setResults] = useState<BacktestResult[]>([]);
  const [running, setRunning] = useState(false);

  // Stocks state
  const [stocks, setStocks] = useState<Top100Stock[]>([]);
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [sectorFilter, setSectorFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Sentiment state
  const [posts, setPosts] = useState<SentimentPost[]>([]);
  const [sentimentFilter, setSentimentFilter] = useState("");

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getBacktestSummary().catch(() => null),
      api.getBacktestResults().catch(() => []),
      api.getTop100Stocks().catch(() => []),
      api.getStockQuotes({ limit: 200 }).catch(() => []),
      api.getSentiment({ days: 7, limit: 50 }).catch(() => []),
    ])
      .then(([s, r, st, q, p]) => {
        setSummary(s);
        setResults(r as BacktestResult[]);
        setStocks(st as Top100Stock[]);
        const quoteMap: Record<string, StockQuote> = {};
        for (const quote of q as StockQuote[]) {
          const existing = quoteMap[quote.ticker];
          if (
            !existing ||
            (quote.ingested_at &&
              existing.ingested_at &&
              quote.ingested_at > existing.ingested_at)
          ) {
            quoteMap[quote.ticker] = quote;
          }
        }
        setQuotes(quoteMap);
        setPosts(p as SentimentPost[]);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleRunBacktest = async () => {
    setRunning(true);
    try {
      const result = await api.runBacktest();
      alert(
        `Tested ${result.signals_tested} signals, created ${result.results_created} results`
      );
      const [s, r] = await Promise.all([
        api.getBacktestSummary(),
        api.getBacktestResults(),
      ]);
      setSummary(s);
      setResults(r);
    } catch {
      alert("Back-test failed.");
    }
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
        if (
          !existing ||
          (q.ingested_at &&
            existing.ingested_at &&
            q.ingested_at > existing.ingested_at)
        ) {
          quoteMap[q.ticker] = q;
        }
      }
      setQuotes(quoteMap);
    } catch {
      alert("Refresh failed.");
    }
    setRefreshing(false);
  };

  function parseTickers(tickersJson: string | null): string[] {
    if (!tickersJson) return [];
    try {
      return JSON.parse(tickersJson);
    } catch {
      return [];
    }
  }

  // Compute data
  const sectorAccuracyData = summary
    ? Object.entries(summary.by_sector).map(([sector, data]) => ({
        sector,
        accuracy_1d: data.accuracy_1d || 0,
        accuracy_7d: data.accuracy_7d || 0,
        total: data.total || 0,
      }))
    : [];

  const sectors = Array.from(
    new Set(stocks.map((s) => s.sector).filter(Boolean))
  ) as string[];
  const filteredStocks = stocks.filter((s) => {
    if (sectorFilter && s.sector !== sectorFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        s.ticker.toLowerCase().includes(term) ||
        s.company_name.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const filteredPosts = posts.filter((p) => {
    if (sentimentFilter && p.sentiment !== sentimentFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading insights...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 pb-24 lg:pb-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Step 4: Validated Insights
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Back-tested results, stock universe, and community sentiment validation
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(
          [
            { id: "backtests", label: "Backtests" },
            { id: "stocks", label: "Stocks" },
            { id: "sentiment", label: "Sentiment" },
          ] as { id: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Backtests Tab */}
      {tab === "backtests" && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button
              onClick={handleRunBacktest}
              disabled={running}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {running ? "Running..." : "Run Back-tests"}
            </button>
          </div>

          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                title="Signals Tested"
                value={summary.total_signals_tested}
                color="blue"
              />
              <StatCard
                title="1-Day Accuracy"
                value={
                  summary.accuracy_1d ? `${summary.accuracy_1d}%` : "N/A"
                }
                color="emerald"
              />
              <StatCard
                title="7-Day Accuracy"
                value={
                  summary.accuracy_7d ? `${summary.accuracy_7d}%` : "N/A"
                }
                color="amber"
              />
              <StatCard
                title="Avg Confidence"
                value={
                  summary.avg_confidence
                    ? `${(summary.avg_confidence * 100).toFixed(0)}%`
                    : "N/A"
                }
                color="purple"
              />
            </div>
          )}

          {sectorAccuracyData.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Accuracy by Sector
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sectorAccuracyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="sector" stroke="#6b7280" fontSize={12} />
                  <YAxis stroke="#6b7280" fontSize={12} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar
                    dataKey="accuracy_1d"
                    name="1-Day"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="accuracy_7d"
                    name="7-Day"
                    fill="#f59e0b"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Individual Results
            </h2>
            {results.length === 0 ? (
              <p className="text-gray-400 text-sm">
                No back-test results yet. Run back-tests to validate signals.
              </p>
            ) : (
              <div className="overflow-x-auto">
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
                    {results.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-2 px-3 font-mono font-semibold text-gray-900">
                          {r.ticker}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              r.direction_predicted === "up"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {r.direction_predicted.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-gray-700">
                          ${r.price_at_signal?.toFixed(2)}
                        </td>
                        <td
                          className={`py-2 px-3 text-right ${
                            (r.actual_1d_change ?? 0) >= 0
                              ? "text-emerald-600"
                              : "text-red-600"
                          }`}
                        >
                          {r.actual_1d_change != null
                            ? `${r.actual_1d_change > 0 ? "+" : ""}${r.actual_1d_change.toFixed(2)}%`
                            : "-"}
                        </td>
                        <td
                          className={`py-2 px-3 text-right ${
                            (r.actual_7d_change ?? 0) >= 0
                              ? "text-emerald-600"
                              : "text-red-600"
                          }`}
                        >
                          {r.actual_7d_change != null
                            ? `${r.actual_7d_change > 0 ? "+" : ""}${r.actual_7d_change.toFixed(2)}%`
                            : "-"}
                        </td>
                        <td
                          className={`py-2 px-3 text-right ${
                            (r.actual_30d_change ?? 0) >= 0
                              ? "text-emerald-600"
                              : "text-red-600"
                          }`}
                        >
                          {r.actual_30d_change != null
                            ? `${r.actual_30d_change > 0 ? "+" : ""}${r.actual_30d_change.toFixed(2)}%`
                            : "-"}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {r.accurate_1d != null
                            ? r.accurate_1d
                              ? "✓"
                              : "✗"
                            : "-"}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {r.accurate_7d != null
                            ? r.accurate_7d
                              ? "✓"
                              : "✗"
                            : "-"}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {r.accurate_30d != null
                            ? r.accurate_30d
                              ? "✓"
                              : "✗"
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stocks Tab */}
      {tab === "stocks" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={handleRefreshStocks}
              disabled={refreshing}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {refreshing ? "Refreshing..." : "Refresh Quotes"}
            </button>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-wrap gap-4 items-center">
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
              {sectors.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Ticker</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Sector</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">Change</th>
                  <th className="px-4 py-3 text-right">% Change</th>
                </tr>
              </thead>
              <tbody>
                {filteredStocks.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-gray-400"
                    >
                      No stocks found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredStocks.map((stock) => {
                    const quote = quotes[stock.ticker];
                    const changeColor =
                      quote?.percent_change && quote.percent_change > 0
                        ? "text-emerald-600"
                        : quote?.percent_change && quote.percent_change < 0
                        ? "text-red-600"
                        : "text-gray-500";

                    return (
                      <tr
                        key={stock.ticker}
                        onClick={() =>
                          router.push(`/stocks/${stock.ticker}`)
                        }
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3 text-sm text-gray-400">
                          {stock.market_cap_rank}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm font-semibold text-emerald-600">
                            {stock.ticker.replace(".TO", "")}
                          </span>
                          <span className="text-gray-400 text-xs ml-1">
                            .TO
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {stock.company_name}
                        </td>
                        <td className="px-4 py-3">
                          {stock.sector && (
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                SECTOR_COLORS[stock.sector] ||
                                SECTOR_COLORS.Other
                              }`}
                            >
                              {stock.sector}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-mono text-gray-900">
                          {quote?.current_price
                            ? `$${quote.current_price.toFixed(2)}`
                            : "--"}
                        </td>
                        <td
                          className={`px-4 py-3 text-right text-sm font-mono ${changeColor}`}
                        >
                          {quote?.price_change != null
                            ? `${quote.price_change > 0 ? "+" : ""}${quote.price_change.toFixed(2)}`
                            : "--"}
                        </td>
                        <td
                          className={`px-4 py-3 text-right text-sm font-mono font-semibold ${changeColor}`}
                        >
                          {quote?.percent_change != null
                            ? `${quote.percent_change > 0 ? "+" : ""}${quote.percent_change.toFixed(2)}%`
                            : "--"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sentiment Tab */}
      {tab === "sentiment" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4 bg-gray-50 border border-gray-200 rounded-xl p-4 items-center">
            <select
              value={sentimentFilter}
              onChange={(e) => setSentimentFilter(e.target.value)}
              className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
            >
              <option value="">All Sentiment</option>
              <option value="positive">Positive</option>
              <option value="negative">Negative</option>
              <option value="neutral">Neutral</option>
            </select>
            <span className="text-xs text-gray-400">
              Showing {filteredPosts.length} of {posts.length} posts
            </span>
          </div>

          {filteredPosts.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
              <p className="text-gray-400">No sentiment data found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPosts.map((post) => {
                const tickers = parseTickers(post.tickers_mentioned);
                const sentimentColor =
                  post.sentiment === "positive"
                    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                    : post.sentiment === "negative"
                    ? "bg-red-100 text-red-700 border-red-200"
                    : post.sentiment === "neutral"
                    ? "bg-amber-100 text-amber-700 border-amber-200"
                    : "bg-gray-100 text-gray-500 border-gray-200";

                return (
                  <div
                    key={post.id}
                    className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 line-clamp-3">
                          {post.content}
                        </p>
                        {tickers.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {tickers.map((t) => (
                              <span
                                key={t}
                                className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-mono"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                          <span className="bg-gray-100 px-2 py-0.5 rounded">
                            {post.source}
                          </span>
                          {post.author && <span>u/{post.author}</span>}
                          <span>{post.upvotes} upvotes</span>
                          <span>{post.comments_count} comments</span>
                          {post.url && (
                            <a
                              href={post.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-500"
                            >
                              View
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {post.sentiment ? (
                          <span
                            className={`text-xs px-3 py-1 rounded-full border ${sentimentColor}`}
                          >
                            {post.sentiment}
                          </span>
                        ) : (
                          <span className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-400 border border-gray-200">
                            unprocessed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
