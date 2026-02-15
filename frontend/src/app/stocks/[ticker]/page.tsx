"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, StockDetail } from "@/lib/api";
import StatCard from "@/components/StatCard";
import TickerLink from "@/components/TickerLink";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "bg-emerald-100 text-emerald-700",
  negative: "bg-red-100 text-red-700",
  neutral: "bg-gray-100 text-gray-500",
};

export default function StockDetailPage() {
  const params = useParams();
  const ticker = decodeURIComponent(params.ticker as string);
  const [data, setData] = useState<StockDetail | null>(null);
  const [history, setHistory] = useState<Array<{ date: string; price: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [detail, historyData] = await Promise.all([
          api.getStockDetail(ticker),
          api.getStockHistory(ticker, 30),
        ]);
        setData(detail);
        setHistory(
          historyData
            .filter((q) => q.current_price != null)
            .map((q) => ({
              date: q.quote_time
                ? new Date(q.quote_time).toLocaleDateString("en-CA", { month: "short", day: "numeric" })
                : "",
              price: q.current_price!,
            }))
            .reverse()
        );
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [ticker]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error || "Stock not found"}</p>
        <Link href="/stocks" className="text-emerald-600 hover:underline mt-2 inline-block">
          Back to Stocks
        </Link>
      </div>
    );
  }

  const q = data.quote;
  const isPositive = q && q.percent_change != null && q.percent_change >= 0;

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/stocks" className="text-sm text-gray-500 hover:text-emerald-600 transition-colors">
            &larr; Back to Stocks
          </Link>
          <h1 className="text-2xl font-bold mt-1 text-gray-900">
            <span className="font-mono text-emerald-600">{ticker}</span>
            {data.company_name && (
              <span className="text-gray-700 ml-3">{data.company_name}</span>
            )}
          </h1>
          <div className="flex gap-3 mt-1 text-sm text-gray-500">
            {data.sector && <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700">{data.sector}</span>}
            {data.exchange && <span>{data.exchange}</span>}
          </div>
        </div>
      </div>

      {/* Price + Sentiment Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Price"
          value={q?.current_price ? `$${q.current_price.toFixed(2)}` : "N/A"}
          subtitle={
            q?.percent_change != null
              ? `${isPositive ? "+" : ""}${q.percent_change.toFixed(2)}%`
              : undefined
          }
          color={isPositive ? "emerald" : "red"}
        />
        <StatCard
          title="Volume"
          value={q?.volume ? q.volume.toLocaleString() : "N/A"}
          subtitle={q?.market_cap ? `Mkt Cap: $${(q.market_cap / 1e9).toFixed(1)}B` : undefined}
          color="blue"
        />
        <StatCard
          title="Signals"
          value={String(data.signals.length)}
          subtitle={`${data.signals.filter((s) => s.sentiment === "positive").length} bullish`}
          color="amber"
        />
        <StatCard
          title="Sentiment"
          value={
            data.sentiment_summary
              ? `${data.sentiment_summary.positive_count}+ / ${data.sentiment_summary.negative_count}-`
              : "N/A"
          }
          subtitle={
            data.sentiment_summary
              ? `${data.sentiment_summary.total_mentions} mentions`
              : "No mentions"
          }
          color="purple"
        />
      </div>

      {/* Price Chart */}
      {history.length > 1 && (
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h2 className="text-lg font-semibold mb-3 text-gray-900">Price History</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                labelStyle={{ color: "#6b7280" }}
              />
              <Line type="monotone" dataKey="price" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Signals */}
      {data.signals.length > 0 && (
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h2 className="text-lg font-semibold mb-3 text-gray-900">Trading Signals</h2>
          <div className="space-y-3">
            {data.signals.map((s) => (
              <Link
                key={s.id}
                href={`/signals/${s.id}`}
                className="block bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors border border-gray-100"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded ${
                        s.direction === "up" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      }`}
                    >
                      {s.direction?.toUpperCase() || "—"}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${SENTIMENT_COLORS[s.sentiment] || ""}`}>
                      {s.sentiment}
                    </span>
                    <span className="text-sm text-gray-700">{s.insight_type || ""}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-emerald-600 font-mono text-sm">{(s.confidence * 100).toFixed(0)}%</span>
                    <span className="text-xs text-gray-400 ml-2">{s.time_horizon || ""}</span>
                  </div>
                </div>
                {s.reasoning && (
                  <p className="text-sm text-gray-500 mt-2 line-clamp-2">{s.reasoning}</p>
                )}
                {s.article_title && (
                  <p className="text-xs text-gray-400 mt-1">Source: {s.article_title}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Backtest Results */}
      {data.backtest_results.length > 0 && (
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h2 className="text-lg font-semibold mb-3 text-gray-900">Backtest Results</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-gray-200">
                  <th className="text-left py-2">Predicted</th>
                  <th className="text-right py-2">Price at Signal</th>
                  <th className="text-right py-2">1D Change</th>
                  <th className="text-right py-2">7D Change</th>
                  <th className="text-center py-2">1D Accurate</th>
                  <th className="text-center py-2">7D Accurate</th>
                </tr>
              </thead>
              <tbody>
                {data.backtest_results.map((b) => (
                  <tr key={b.id} className="border-b border-gray-100">
                    <td className="py-2">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded ${
                          b.direction_predicted === "up"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {b.direction_predicted.toUpperCase()}
                      </span>
                    </td>
                    <td className="text-right py-2 text-gray-700">{b.price_at_signal ? `$${b.price_at_signal.toFixed(2)}` : "—"}</td>
                    <td
                      className={`text-right py-2 ${
                        b.actual_1d_change != null && b.actual_1d_change >= 0 ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {b.actual_1d_change != null ? `${b.actual_1d_change >= 0 ? "+" : ""}${b.actual_1d_change.toFixed(2)}%` : "—"}
                    </td>
                    <td
                      className={`text-right py-2 ${
                        b.actual_7d_change != null && b.actual_7d_change >= 0 ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {b.actual_7d_change != null ? `${b.actual_7d_change >= 0 ? "+" : ""}${b.actual_7d_change.toFixed(2)}%` : "—"}
                    </td>
                    <td className="text-center py-2">
                      {b.accurate_1d === true ? "✓" : b.accurate_1d === false ? "✗" : "—"}
                    </td>
                    <td className="text-center py-2">
                      {b.accurate_7d === true ? "✓" : b.accurate_7d === false ? "✗" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Related Articles */}
      {data.related_articles.length > 0 && (
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h2 className="text-lg font-semibold mb-3 text-gray-900">Related News</h2>
          <div className="space-y-2">
            {data.related_articles.map((a) => (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-gray-50 rounded p-3 hover:bg-gray-100 transition-colors border border-gray-100"
              >
                <p className="text-sm font-medium text-gray-900">{a.title}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                  <span>{a.source}</span>
                  {a.published_at && <span>{new Date(a.published_at).toLocaleDateString()}</span>}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Community Sentiment */}
      {data.recent_sentiment.length > 0 && (
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h2 className="text-lg font-semibold mb-3 text-gray-900">Community Sentiment</h2>
          <div className="space-y-2">
            {data.recent_sentiment.slice(0, 10).map((p) => (
              <a
                key={p.id}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-gray-50 rounded p-3 hover:bg-gray-100 transition-colors border border-gray-100"
              >
                <p className="text-sm line-clamp-2 text-gray-800">{p.content}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span>{p.source}</span>
                  <span>▲ {p.upvotes}</span>
                  <span>💬 {p.comments_count}</span>
                  {p.sentiment && (
                    <span className={`px-1.5 py-0.5 rounded ${SENTIMENT_COLORS[p.sentiment] || ""}`}>
                      {p.sentiment}
                    </span>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
