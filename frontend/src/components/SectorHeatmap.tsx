"use client";

import Link from "next/link";
import { SectorHeatmapEntry } from "@/lib/api";

interface SectorHeatmapProps {
  sectors: SectorHeatmapEntry[];
}

function getSentimentColor(score: number): string {
  // score ranges from -1 (bearish) to +1 (bullish)
  if (score >= 0.5) return "bg-emerald-500/30 border-emerald-500/40";
  if (score >= 0.15) return "bg-emerald-500/15 border-emerald-500/25";
  if (score > -0.15) return "bg-amber-500/15 border-amber-500/25";
  if (score > -0.5) return "bg-red-500/15 border-red-500/25";
  return "bg-red-500/30 border-red-500/40";
}

function getSentimentLabel(score: number): string {
  if (score >= 0.5) return "Bullish";
  if (score >= 0.15) return "Lean Bullish";
  if (score > -0.15) return "Neutral";
  if (score > -0.5) return "Lean Bearish";
  return "Bearish";
}

function getSentimentTextColor(score: number): string {
  if (score >= 0.15) return "text-emerald-400";
  if (score > -0.15) return "text-amber-400";
  return "text-red-400";
}

export default function SectorHeatmap({ sectors }: SectorHeatmapProps) {
  if (sectors.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold mb-3">Sector Heatmap</h2>
        <p className="text-slate-500 text-sm">No sector data available yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <h2 className="text-lg font-semibold mb-4">Sector Heatmap</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {sectors.map((s) => (
          <Link
            key={s.sector}
            href={`/stocks?sector=${encodeURIComponent(s.sector)}`}
            className={`rounded-lg border p-4 transition-all hover:scale-[1.02] ${getSentimentColor(
              s.avg_sentiment_score
            )}`}
          >
            <div className="text-sm font-semibold text-slate-200 mb-1">{s.sector}</div>
            <div className={`text-xs font-medium ${getSentimentTextColor(s.avg_sentiment_score)}`}>
              {getSentimentLabel(s.avg_sentiment_score)}
            </div>
            <div className="mt-2 space-y-0.5 text-xs text-slate-400">
              <div>{s.signal_count} signals</div>
              {s.avg_price_change != null && (
                <div
                  className={
                    s.avg_price_change >= 0 ? "text-emerald-400" : "text-red-400"
                  }
                >
                  {s.avg_price_change >= 0 ? "+" : ""}
                  {s.avg_price_change}% avg
                </div>
              )}
              {s.accuracy != null && <div>Accuracy: {s.accuracy}%</div>}
              {s.top_ticker && (
                <div className="font-mono text-emerald-400/70">{s.top_ticker}</div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
