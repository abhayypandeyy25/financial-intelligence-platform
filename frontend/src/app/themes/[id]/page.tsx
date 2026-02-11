"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, ThemeDetail } from "@/lib/api";
import TickerLink from "@/components/TickerLink";

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "bg-emerald-500/20 text-emerald-400",
  negative: "bg-red-500/20 text-red-400",
  neutral: "bg-slate-500/20 text-slate-400",
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
        <p className="text-red-400">{error || "Theme not found"}</p>
        <Link href="/themes" className="text-emerald-400 hover:underline mt-2 inline-block">
          Back to Themes
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <Link href="/themes" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors">
          &larr; Back to Themes
        </Link>
        <h1 className="text-2xl font-bold mt-1">{data.name}</h1>
        <div className="flex gap-3 mt-2 text-sm">
          {data.sector && <span className="bg-slate-700 px-2 py-0.5 rounded text-slate-300">{data.sector}</span>}
          {data.relevance_score != null && (
            <span className="text-emerald-400">
              Relevance: {(data.relevance_score * 100).toFixed(0)}%
            </span>
          )}
          <span className="text-slate-400">{data.article_count} articles</span>
        </div>
      </div>

      {/* Description */}
      {data.description && (
        <div className="bg-slate-800 rounded-lg p-5">
          <p className="text-slate-200 leading-relaxed">{data.description}</p>
        </div>
      )}

      {/* Contributing Articles */}
      {data.articles.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-5">
          <h2 className="text-lg font-semibold mb-3">Contributing Articles ({data.articles.length})</h2>
          <div className="space-y-2">
            {data.articles.map((a) => (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-slate-700/50 rounded p-3 hover:bg-slate-700 transition-colors"
              >
                <p className="text-sm font-medium">{a.title}</p>
                {a.summary && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{a.summary}</p>}
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
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
        <div className="bg-slate-800 rounded-lg p-5">
          <h2 className="text-lg font-semibold mb-3">Related Signals ({data.related_signals.length})</h2>
          <div className="space-y-2">
            {data.related_signals.map((s) => (
              <Link
                key={s.id}
                href={`/signals/${s.id}`}
                className="block bg-slate-700/50 rounded p-3 hover:bg-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TickerLink ticker={s.stock_ticker} />
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${
                        s.direction === "up" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {s.direction?.toUpperCase() || "—"}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${SENTIMENT_COLORS[s.sentiment] || ""}`}>
                      {s.sentiment}
                    </span>
                  </div>
                  <span className="text-emerald-400 font-mono text-sm">
                    {(s.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                {s.reasoning && (
                  <p className="text-sm text-slate-400 mt-1 line-clamp-1">{s.reasoning}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
