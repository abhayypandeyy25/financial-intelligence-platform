"use client";

import Link from "next/link";
import { SectorHeatmapEntry } from "@/lib/api";

interface SectorHeatmapProps {
  sectors: SectorHeatmapEntry[];
}

function getSentimentColor(score: number): string {
  if (score >= 0.5) return "bg-emerald-100 border-emerald-300";
  if (score >= 0.15) return "bg-emerald-50 border-emerald-200";
  if (score > -0.15) return "bg-amber-50 border-amber-200";
  if (score > -0.5) return "bg-red-50 border-red-200";
  return "bg-red-100 border-red-300";
}

function getSentimentLabel(score: number): string {
  if (score >= 0.5) return "Bullish";
  if (score >= 0.15) return "Lean Bullish";
  if (score > -0.15) return "Neutral";
  if (score > -0.5) return "Lean Bearish";
  return "Bearish";
}

function getSentimentTextColor(score: number): string {
  if (score >= 0.15) return "text-emerald-600";
  if (score > -0.15) return "text-amber-600";
  return "text-red-600";
}

export default function SectorHeatmap({ sectors }: SectorHeatmapProps) {
  if (sectors.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Sector Heatmap</h2>
        <p className="text-gray-400 text-sm">No sector data available yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Sector Heatmap</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {sectors.map((s) => (
          <Link
            key={s.sector}
            href={`/sectors/${encodeURIComponent(s.sector)}`}
            className={`rounded-lg border p-4 transition-all hover:scale-[1.02] ${getSentimentColor(
              s.avg_sentiment_score
            )}`}
          >
            <div className="text-sm font-semibold text-gray-900 mb-1">{s.sector}</div>
            <div className={`text-xs font-medium ${getSentimentTextColor(s.avg_sentiment_score)}`}>
              {getSentimentLabel(s.avg_sentiment_score)}
            </div>
            <div className="mt-2 space-y-0.5 text-xs text-gray-500">
              <div>{s.signal_count} signals</div>
              {s.avg_price_change != null && (
                <div
                  className={
                    s.avg_price_change >= 0 ? "text-emerald-600" : "text-red-600"
                  }
                >
                  {s.avg_price_change >= 0 ? "+" : ""}
                  {s.avg_price_change}% avg
                </div>
              )}
              {s.accuracy != null && <div>Accuracy: {s.accuracy}%</div>}
              {s.top_ticker && (
                <div className="font-mono text-emerald-600">{s.top_ticker}</div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
