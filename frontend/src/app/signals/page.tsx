"use client";

import { useEffect, useState } from "react";
import { api, Signal } from "@/lib/api";

const SECTORS = ["All", "Energy", "Mining", "Finance", "Technology", "Healthcare"];
const SENTIMENTS = ["All", "positive", "negative", "neutral"];

export default function SignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [sectorFilter, setSectorFilter] = useState("All");
  const [sentimentFilter, setSentimentFilter] = useState("All");
  const [minConfidence, setMinConfidence] = useState(0);

  const fetchSignals = () => {
    setLoading(true);
    const params: Record<string, string | number> = {};
    if (sectorFilter !== "All") params.sector = sectorFilter;
    if (sentimentFilter !== "All") params.sentiment = sentimentFilter;
    if (minConfidence > 0) params.min_confidence = minConfidence / 100;
    api
      .getSignals(params)
      .then(setSignals)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSignals();
  }, [sectorFilter, sentimentFilter, minConfidence]);

  const handleProcess = async () => {
    setProcessing(true);
    try {
      const result = await api.processSignals();
      alert(`Processed ${result.articles_processed} articles, generated ${result.signals_generated} signals`);
      fetchSignals();
    } catch {
      alert("Processing failed. Check if the backend is running.");
    }
    setProcessing(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Signals</h1>
          <p className="text-slate-400 text-sm mt-1">
            AI-generated investment signals from financial news
          </p>
        </div>
        <button
          onClick={handleProcess}
          disabled={processing}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
        >
          {processing ? "Processing..." : "Process New Articles"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div>
          <label className="text-xs text-slate-400 block mb-1">Sector</label>
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm"
          >
            {SECTORS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Sentiment</label>
          <select
            value={sentimentFilter}
            onChange={(e) => setSentimentFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm"
          >
            {SENTIMENTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Min Confidence</label>
          <input
            type="range"
            min={0}
            max={100}
            value={minConfidence}
            onChange={(e) => setMinConfidence(Number(e.target.value))}
            className="w-32"
          />
          <span className="text-xs text-slate-400 ml-2">{minConfidence}%</span>
        </div>
      </div>

      {/* Signal Cards */}
      {loading ? (
        <div className="text-slate-400 text-center py-12">Loading signals...</div>
      ) : signals.length === 0 ? (
        <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-slate-400">No signals found.</p>
          <p className="text-slate-500 text-sm mt-1">
            Try ingesting news first, then process articles to generate signals.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {signals.map((signal) => (
            <div
              key={signal.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-lg font-bold text-white">
                      {signal.stock_ticker}
                    </span>
                    {signal.stock_name && (
                      <span className="text-slate-400 text-sm">{signal.stock_name}</span>
                    )}
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
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
                          ? "bg-emerald-500/10 text-emerald-300"
                          : signal.sentiment === "negative"
                          ? "bg-red-500/10 text-red-300"
                          : "bg-amber-500/10 text-amber-300"
                      }`}
                    >
                      {signal.sentiment}
                    </span>
                    {signal.sector && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300">
                        {signal.sector}
                      </span>
                    )}
                    {signal.insight_type && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300">
                        {signal.insight_type}
                      </span>
                    )}
                  </div>

                  {signal.reasoning && (
                    <p className="text-slate-300 text-sm mt-2">{signal.reasoning}</p>
                  )}

                  {signal.impact_hypothesis && (
                    <p className="text-slate-400 text-xs mt-2 italic">
                      Impact: {signal.impact_hypothesis}
                    </p>
                  )}

                  <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                    {signal.article_title && (
                      <span>Source: {signal.article_source} - {signal.article_title.slice(0, 60)}...</span>
                    )}
                    {signal.time_horizon && <span>Horizon: {signal.time_horizon}</span>}
                    {signal.created_at && (
                      <span>{new Date(signal.created_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>

                <div className="text-right ml-4">
                  <div className="text-2xl font-bold">
                    {(signal.confidence * 100).toFixed(0)}%
                  </div>
                  <div className="text-xs text-slate-500">confidence</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
