"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, SignalDetail } from "@/lib/api";
import { useStep } from "@/context/StepContext";
import TickerLink from "@/components/TickerLink";
import DetailNav from "@/components/DetailNav";

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "bg-emerald-100 text-emerald-700 border-emerald-200",
  negative: "bg-red-100 text-red-700 border-red-200",
  neutral: "bg-gray-100 text-gray-500 border-gray-200",
};

export default function SignalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { setActiveStep } = useStep();
  const signalId = Number(params.id);
  const [data, setData] = useState<SignalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getSignalDetail(signalId)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [signalId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 text-center py-12">
        <p className="text-red-600">{error || "Signal not found"}</p>
        <button
          onClick={() => { setActiveStep(3); router.push("/"); }}
          className="text-emerald-600 hover:underline mt-2 inline-block text-sm"
        >
          Back to Signals
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl pb-24 lg:pb-6">
      {/* Navigation */}
      <DetailNav backLabel="Back to Signals" backStep={3} />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Signal #{data.id}</h1>
      </div>

      {/* Signal Card */}
      <div className={`bg-white rounded-lg p-6 border ${SENTIMENT_COLORS[data.sentiment] || "border-gray-200"}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <TickerLink ticker={data.stock_ticker} showSuffix size="lg" />
            {data.stock_name && <span className="text-gray-700">{data.stock_name}</span>}
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`text-sm font-bold px-3 py-1 rounded ${
                data.direction === "up" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
              }`}
            >
              {data.direction?.toUpperCase() || "—"}
            </span>
            <span className={`text-sm px-3 py-1 rounded ${SENTIMENT_COLORS[data.sentiment] || ""}`}>
              {data.sentiment}
            </span>
            <span className="text-emerald-600 font-mono text-lg font-bold">
              {(data.confidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
          <div>
            <span className="text-gray-400">Sector</span>
            <p className="text-gray-800">{data.sector || "—"}</p>
          </div>
          <div>
            <span className="text-gray-400">Time Horizon</span>
            <p className="text-gray-800">{data.time_horizon || "—"}</p>
          </div>
          <div>
            <span className="text-gray-400">Insight Type</span>
            <p className="text-gray-800">{data.insight_type || "—"}</p>
          </div>
        </div>

        {data.reasoning && (
          <div className="mb-3">
            <span className="text-gray-400 text-sm">Reasoning</span>
            <p className="text-gray-800 mt-1">{data.reasoning}</p>
          </div>
        )}

        {data.impact_hypothesis && (
          <div>
            <span className="text-gray-400 text-sm">Impact Hypothesis</span>
            <p className="text-gray-800 mt-1">{data.impact_hypothesis}</p>
          </div>
        )}
      </div>

      {/* Source Article */}
      {data.article && (
        <div className="bg-white rounded-lg p-5 border border-gray-200">
          <h2 className="text-lg font-semibold mb-3 text-gray-900">Source Article</h2>
          <a
            href={data.article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-600 hover:underline font-medium"
          >
            {data.article.title}
          </a>
          <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
            <span>{data.article.source}</span>
            {data.article.published_at && (
              <span>{new Date(data.article.published_at).toLocaleDateString()}</span>
            )}
            <span className={data.article.processed ? "text-emerald-600" : "text-amber-500"}>
              {data.article.processed ? "Processed" : "Unprocessed"}
            </span>
          </div>
          {data.article.summary && (
            <p className="text-sm text-gray-700 mt-3">{data.article.summary}</p>
          )}
        </div>
      )}

      {/* Stock Context */}
      {data.stock_quote && (
        <div className="bg-white rounded-lg p-5 border border-gray-200">
          <h2 className="text-lg font-semibold mb-3 text-gray-900">Stock Context</h2>
          <div className="flex items-center justify-between">
            <div>
              <TickerLink ticker={data.stock_ticker} showSuffix size="md" />
              <span className="text-2xl font-bold ml-4 text-gray-900">
                ${data.stock_quote.current_price?.toFixed(2) || "—"}
              </span>
              {data.stock_quote.percent_change != null && (
                <span
                  className={`ml-2 text-sm font-medium ${
                    data.stock_quote.percent_change >= 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {data.stock_quote.percent_change >= 0 ? "+" : ""}
                  {data.stock_quote.percent_change.toFixed(2)}%
                </span>
              )}
            </div>
            <Link
              href={`/stocks/${data.stock_ticker}`}
              className="text-sm text-emerald-600 hover:underline"
            >
              View Full Stock Detail &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* Backtest Result */}
      {data.backtest && (
        <div className="bg-white rounded-lg p-5 border border-gray-200">
          <h2 className="text-lg font-semibold mb-3 text-gray-900">Backtest Validation</h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "1-Day", change: data.backtest.actual_1d_change, accurate: data.backtest.accurate_1d },
              { label: "7-Day", change: data.backtest.actual_7d_change, accurate: data.backtest.accurate_7d },
              { label: "30-Day", change: data.backtest.actual_30d_change, accurate: data.backtest.accurate_30d },
            ].map((period) => (
              <div key={period.label} className="bg-gray-50 rounded p-3 text-center border border-gray-100">
                <p className="text-xs text-gray-500">{period.label}</p>
                <p
                  className={`text-lg font-bold ${
                    period.change != null && period.change >= 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {period.change != null ? `${period.change >= 0 ? "+" : ""}${period.change.toFixed(2)}%` : "—"}
                </p>
                <p className="text-xs mt-1">
                  {period.accurate === true ? (
                    <span className="text-emerald-600">Correct</span>
                  ) : period.accurate === false ? (
                    <span className="text-red-600">Incorrect</span>
                  ) : (
                    <span className="text-gray-400">Pending</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Related Signals */}
      {data.related_signals.length > 0 && (
        <div className="bg-white rounded-lg p-5 border border-gray-200">
          <h2 className="text-lg font-semibold mb-3 text-gray-900">Related Signals for {data.stock_ticker}</h2>
          <div className="space-y-2">
            {data.related_signals.map((s) => (
              <Link
                key={s.id}
                href={`/signals/${s.id}`}
                className="block bg-gray-50 rounded p-3 hover:bg-gray-100 transition-colors border border-gray-100"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${
                        s.direction === "up" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      }`}
                    >
                      {s.direction?.toUpperCase() || "—"}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${SENTIMENT_COLORS[s.sentiment] || ""}`}>
                      {s.sentiment}
                    </span>
                    <span className="text-sm text-gray-700 line-clamp-1">{s.reasoning}</span>
                  </div>
                  <span className="text-emerald-600 font-mono text-sm">{(s.confidence * 100).toFixed(0)}%</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
