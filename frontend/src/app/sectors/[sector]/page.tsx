"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  api,
  Signal,
  Top100Stock,
  StockQuote,
  BacktestSummary,
  Theme,
} from "@/lib/api";
import DetailNav from "@/components/DetailNav";
import TickerLink from "@/components/TickerLink";
import StatCard from "@/components/StatCard";

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "bg-emerald-100 text-emerald-700",
  negative: "bg-red-100 text-red-700",
  neutral: "bg-gray-100 text-gray-500",
};

export default function SectorDetailPage() {
  const params = useParams();
  const sector = decodeURIComponent(params.sector as string);

  const [signals, setSignals] = useState<Signal[]>([]);
  const [stocks, setStocks] = useState<Top100Stock[]>([]);
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [backtestSummary, setBacktestSummary] = useState<BacktestSummary | null>(null);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getSignals({ sector }).catch(() => []),
      api.getTop100Stocks(sector).catch(() => []),
      api.getStockQuotes({ limit: 200 }).catch(() => []),
      api.getBacktestSummary().catch(() => null),
      api.getThemes(30).catch(() => []),
    ])
      .then(([sigs, stks, quotesArr, bt, thms]) => {
        setSignals(sigs as Signal[]);
        setStocks(stks as Top100Stock[]);

        const quoteMap: Record<string, StockQuote> = {};
        for (const q of quotesArr as StockQuote[]) {
          const existing = quoteMap[q.ticker];
          if (!existing || (q.ingested_at && existing.ingested_at && q.ingested_at > existing.ingested_at)) {
            quoteMap[q.ticker] = q;
          }
        }
        setQuotes(quoteMap);

        setBacktestSummary(bt as BacktestSummary | null);
        setThemes((thms as Theme[]).filter((t) => t.sector === sector));
      })
      .finally(() => setLoading(false));
  }, [sector]);

  const positiveCount = signals.filter((s) => s.sentiment === "positive").length;
  const negativeCount = signals.filter((s) => s.sentiment === "negative").length;
  const neutralCount = signals.filter((s) => s.sentiment === "neutral").length;
  const avgConfidence =
    signals.length > 0
      ? signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length
      : 0;

  const sectorAccuracy = backtestSummary?.by_sector?.[sector];

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-4 bg-gray-100 rounded w-80" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 pb-24 lg:pb-6">
      {/* Navigation */}
      <DetailNav backLabel="Back to Insights" backStep={4} />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{sector} Sector</h1>
        <p className="text-gray-500 text-sm mt-1">
          {signals.length} signals &middot; {stocks.length} stocks &middot; {themes.length} themes
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Signals"
          value={signals.length}
          subtitle={`${positiveCount} bullish, ${negativeCount} bearish`}
          color="emerald"
        />
        <StatCard
          title="Avg Confidence"
          value={`${(avgConfidence * 100).toFixed(0)}%`}
          color="blue"
        />
        <StatCard
          title="7D Accuracy"
          value={
            sectorAccuracy?.accuracy_7d != null
              ? `${sectorAccuracy.accuracy_7d}%`
              : "N/A"
          }
          color="amber"
        />
        <StatCard
          title="Stocks Tracked"
          value={stocks.length}
          color="purple"
        />
      </div>

      {/* Signals */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Recent Signals ({signals.length})
        </h2>
        {signals.length === 0 ? (
          <p className="text-gray-400 text-sm bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
            No signals found for this sector yet.
          </p>
        ) : (
          <div className="space-y-2">
            {signals.slice(0, 20).map((signal) => (
              <Link
                key={signal.id}
                href={`/signals/${signal.id}`}
                className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <TickerLink ticker={signal.stock_ticker} showSuffix size="md" />
                      {signal.stock_name && (
                        <span className="text-gray-500 text-sm">{signal.stock_name}</span>
                      )}
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          signal.direction === "up"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {signal.direction?.toUpperCase()}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          SENTIMENT_COLORS[signal.sentiment] || ""
                        }`}
                      >
                        {signal.sentiment}
                      </span>
                    </div>
                    {signal.reasoning && (
                      <p className="text-gray-700 text-sm mt-2 line-clamp-2">
                        {signal.reasoning}
                      </p>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-xl font-bold text-gray-900">
                      {(signal.confidence * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs text-gray-400">confidence</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Stocks */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Stocks in {sector} ({stocks.length})
        </h2>
        {stocks.length === 0 ? (
          <p className="text-gray-400 text-sm bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
            No stocks found for this sector.
          </p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4">Ticker</th>
                  <th className="text-left py-3 px-4">Company</th>
                  <th className="text-right py-3 px-4">Price</th>
                  <th className="text-right py-3 px-4">Change</th>
                  <th className="text-right py-3 px-4">Signals</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map((stock) => {
                  const q = quotes[stock.ticker];
                  const signalCount = signals.filter(
                    (s) => s.stock_ticker === stock.ticker
                  ).length;
                  return (
                    <tr
                      key={stock.ticker}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <Link
                          href={`/stocks/${encodeURIComponent(stock.ticker)}`}
                          className="font-mono text-emerald-600 hover:underline font-medium"
                        >
                          {stock.ticker}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-gray-700">{stock.company_name}</td>
                      <td className="py-3 px-4 text-right text-gray-900 font-medium">
                        {q?.current_price ? `$${q.current_price.toFixed(2)}` : "---"}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-medium ${
                          q?.percent_change != null && q.percent_change >= 0
                            ? "text-emerald-600"
                            : "text-red-600"
                        }`}
                      >
                        {q?.percent_change != null
                          ? `${q.percent_change >= 0 ? "+" : ""}${q.percent_change.toFixed(2)}%`
                          : "---"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {signalCount > 0 ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                            {signalCount}
                          </span>
                        ) : (
                          <span className="text-gray-300">---</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Themes */}
      {themes.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Related Themes ({themes.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {themes.map((theme) => (
              <Link
                key={theme.id}
                href={`/themes/${theme.id}`}
                className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <h3 className="font-semibold text-gray-900">{theme.name}</h3>
                {theme.description && (
                  <p className="text-gray-500 text-sm mt-1 line-clamp-2">
                    {theme.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                  <span>{theme.article_count} articles</span>
                  {theme.relevance_score != null && (
                    <span className="text-emerald-600">
                      {(theme.relevance_score * 100).toFixed(0)}% relevant
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
