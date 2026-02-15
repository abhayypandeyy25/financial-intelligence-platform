"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, ThemeDetail } from "@/lib/api";
import TickerLink from "@/components/TickerLink";
import DetailNav from "@/components/DetailNav";

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "bg-emerald-100 text-emerald-700",
  negative: "bg-red-100 text-red-700",
  neutral: "bg-gray-100 text-gray-500",
};

export default function ThemeDetailPage() {
  const params = useParams();
  const themeId = Number(params.id);
  const [data, setData] = useState<ThemeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getThemeDetail(themeId)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [themeId]);

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
        <p className="text-red-600">{error || "Theme not found"}</p>
        <Link href="/themes" className="text-emerald-600 hover:underline mt-2 inline-block">
          Back to Themes
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl pb-24 lg:pb-6">
      {/* Navigation */}
      <DetailNav backLabel="Back to Themes" backHref="/themes" />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{data.name}</h1>
        <div className="flex gap-3 mt-2 text-sm">
          {data.sector && <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700">{data.sector}</span>}
          {data.relevance_score != null && (
            <span className="text-emerald-600">
              Relevance: {(data.relevance_score * 100).toFixed(0)}%
            </span>
          )}
          <span className="text-gray-500">{data.article_count} articles</span>
        </div>
      </div>

      {/* Description */}
      {data.description && (
        <div className="bg-white rounded-lg p-5 border border-gray-200">
          <p className="text-gray-800 leading-relaxed">{data.description}</p>
        </div>
      )}

      {/* Contributing Articles */}
      {data.articles.length > 0 && (
        <div className="bg-white rounded-lg p-5 border border-gray-200">
          <h2 className="text-lg font-semibold mb-3 text-gray-900">Contributing Articles ({data.articles.length})</h2>
          <div className="space-y-2">
            {data.articles.map((a) => (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-gray-50 rounded p-3 hover:bg-gray-100 transition-colors border border-gray-100"
              >
                <p className="text-sm font-medium text-gray-900">{a.title}</p>
                {a.summary && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{a.summary}</p>}
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                  <span>{a.source}</span>
                  {a.published_at && <span>{new Date(a.published_at).toLocaleDateString()}</span>}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Related Signals */}
      {data.related_signals.length > 0 && (
        <div className="bg-white rounded-lg p-5 border border-gray-200">
          <h2 className="text-lg font-semibold mb-3 text-gray-900">Related Signals ({data.related_signals.length})</h2>
          <div className="space-y-2">
            {data.related_signals.map((s) => (
              <Link
                key={s.id}
                href={`/signals/${s.id}`}
                className="block bg-gray-50 rounded p-3 hover:bg-gray-100 transition-colors border border-gray-100"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TickerLink ticker={s.stock_ticker} />
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
                  </div>
                  <span className="text-emerald-600 font-mono text-sm">
                    {(s.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                {s.reasoning && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-1">{s.reasoning}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
