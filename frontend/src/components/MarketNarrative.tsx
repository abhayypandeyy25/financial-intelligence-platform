"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function MarketNarrative() {
  const [narrative, setNarrative] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNarrative = (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    api
      .getMarketNarrative()
      .then((r) => setNarrative(r.narrative))
      .catch(() => setNarrative(null))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    fetchNarrative();
  }, []);

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-emerald-50 to-white border border-emerald-200 rounded-xl p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
        <div className="h-4 bg-gray-200 rounded w-full mb-3" />
        <div className="h-4 bg-gray-200 rounded w-5/6" />
      </div>
    );
  }

  if (!narrative) return null;

  return (
    <div className="bg-gradient-to-r from-emerald-50 via-white to-emerald-50 border border-emerald-200 rounded-xl p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <h3 className="text-sm font-semibold text-emerald-700 uppercase tracking-wide">
              AI Market Briefing
            </h3>
          </div>
          <p className="text-gray-700 text-sm leading-relaxed">{narrative}</p>
        </div>
        <button
          onClick={() => fetchNarrative(true)}
          disabled={refreshing}
          className="flex-none text-gray-400 hover:text-gray-600 transition-colors p-1"
          title="Refresh narrative"
        >
          <svg
            className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
