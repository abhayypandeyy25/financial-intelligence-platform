"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Signal, Theme } from "@/lib/api";
import TickerLink from "@/components/TickerLink";

const SECTORS = ["All", "Energy", "Mining", "Finance", "Technology", "Healthcare"];
const SENTIMENTS = ["All", "positive", "negative", "neutral"];

type Tab = "signals" | "themes";

export default function SignalsPanel() {
  const [tab, setTab] = useState<Tab>("signals");
  const [signals, setSignals] = useState<Signal[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [sectorFilter, setSectorFilter] = useState("All");
  const [sentimentFilter, setSentimentFilter] = useState("All");
  const [minConfidence, setMinConfidence] = useState(0);

  const fetchData = () => {
    setLoading(true);
    const params: Record<string, string | number> = {};
    if (sectorFilter !== "All") params.sector = sectorFilter;
    if (sentimentFilter !== "All") params.sentiment = sentimentFilter;
    if (minConfidence > 0) params.min_confidence = minConfidence / 100;

    Promise.all([
      api.getSignals(params).catch(() => []),
      api.getThemes(30).catch(() => []),
    ])
      .then(([s, t]) => {
        setSignals(s as Signal[]);
        setThemes(t as Theme[]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [sectorFilter, sentimentFilter, minConfidence]);

  const handleProcess = async () => {
    setProcessing(true);
    try {
      const result = await api.processSignals();
      alert(
        `Processed ${result.articles_processed} articles, generated ${result.signals_generated} signals`
      );
      fetchData();
    } catch {
      alert("Processing failed.");
    }
    setProcessing(false);
  };

  const handleDetect = async () => {
    setDetecting(true);
    try {
      const result = await api.detectThemes();
      alert(`Detected ${result.themes_detected} themes`);
      fetchData();
    } catch {
      alert("Theme detection failed.");
    }
    setDetecting(false);
  };

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Signal Extraction & Themes
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            AI-generated investment signals and detected market themes
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleProcess}
            disabled={processing}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {processing ? "Processing..." : "Process Articles"}
          </button>
          <button
            onClick={handleDetect}
            disabled={detecting}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {detecting ? "Detecting..." : "Detect Themes"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab("signals")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "signals"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Signals ({signals.length})
        </button>
        <button
          onClick={() => setTab("themes")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "themes"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Themes ({themes.length})
        </button>
      </div>

      {tab === "signals" && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Sector</label>
              <select
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
                className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900"
              >
                {SECTORS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Sentiment
              </label>
              <select
                value={sentimentFilter}
                onChange={(e) => setSentimentFilter(e.target.value)}
                className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900"
              >
                {SENTIMENTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Min Confidence
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))}
                className="w-32"
              />
              <span className="text-xs text-gray-500 ml-2">{minConfidence}%</span>
            </div>
          </div>

          {/* Signal Cards */}
          {loading ? (
            <div className="text-gray-400 text-center py-12">
              Loading signals...
            </div>
          ) : signals.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 border border-gray-200 rounded-xl">
              <p className="text-gray-400">No signals found.</p>
              <p className="text-gray-400 text-sm mt-1">
                Try ingesting news, then process articles to generate signals.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {signals.map((signal) => (
                <Link
                  key={signal.id}
                  href={`/signals/${signal.id}`}
                  className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <TickerLink
                          ticker={signal.stock_ticker}
                          showSuffix
                          size="md"
                        />
                        {signal.stock_name && (
                          <span className="text-gray-500 text-sm">
                            {signal.stock_name}
                          </span>
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
                            signal.sentiment === "positive"
                              ? "bg-emerald-50 text-emerald-600"
                              : signal.sentiment === "negative"
                              ? "bg-red-50 text-red-600"
                              : "bg-amber-50 text-amber-600"
                          }`}
                        >
                          {signal.sentiment}
                        </span>
                        {signal.sector && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                            {signal.sector}
                          </span>
                        )}
                        {signal.insight_type && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">
                            {signal.insight_type}
                          </span>
                        )}
                      </div>
                      {signal.reasoning && (
                        <p className="text-gray-700 text-sm mt-2">
                          {signal.reasoning}
                        </p>
                      )}
                      {signal.impact_hypothesis && (
                        <p className="text-gray-400 text-xs mt-2 italic">
                          Impact: {signal.impact_hypothesis}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                        {signal.article_title && (
                          <span>
                            Source: {signal.article_source} -{" "}
                            {signal.article_title.slice(0, 60)}...
                          </span>
                        )}
                        {signal.time_horizon && (
                          <span>Horizon: {signal.time_horizon}</span>
                        )}
                        {signal.created_at && (
                          <span>
                            {new Date(signal.created_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-2xl font-bold text-gray-900">
                        {(signal.confidence * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-gray-400">confidence</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "themes" && (
        <>
          {loading ? (
            <div className="text-gray-400 text-center py-12">
              Loading themes...
            </div>
          ) : themes.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 border border-gray-200 rounded-xl">
              <p className="text-gray-400">No themes detected yet.</p>
              <p className="text-gray-400 text-sm mt-1">
                Process articles first, then click &quot;Detect Themes&quot;.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {themes.map((theme) => (
                <Link
                  key={theme.id}
                  href={`/themes/${theme.id}`}
                  className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-gray-900">
                      {theme.name}
                    </h3>
                    {theme.relevance_score && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        {(theme.relevance_score * 100).toFixed(0)}% relevant
                      </span>
                    )}
                  </div>
                  {theme.description && (
                    <p className="text-gray-500 text-sm mt-2">
                      {theme.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                    {theme.sector && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                        {theme.sector}
                      </span>
                    )}
                    <span>{theme.article_count} articles</span>
                    {theme.created_at && (
                      <span>
                        {new Date(theme.created_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
