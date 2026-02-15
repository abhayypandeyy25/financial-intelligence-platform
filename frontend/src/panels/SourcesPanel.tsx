"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, DashboardSummary } from "@/lib/api";
import MarketNarrative from "@/components/MarketNarrative";
import StatCard from "@/components/StatCard";
import ConfirmModal from "@/components/ConfirmModal";

interface SourceStatus {
  name: string;
  type: string;
  url: string;
  is_active: boolean;
  last_scrape_time: string | null;
  article_count: number;
  error_message: string | null;
  accounts_tracked?: string[];
}

export default function SourcesPanel() {
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [stats, setStats] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState(false);
  const [showIngestModal, setShowIngestModal] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/sources/status`
      )
        .then((r) => r.json())
        .catch(() => []),
      api.getDashboard().catch(() => null),
    ])
      .then(([src, dash]) => {
        setSources(src);
        setStats(dash);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleIngest = async (): Promise<string> => {
    const result = await api.triggerIngestion();
    // Refresh sources + dashboard stats so numbers update
    const [src, dash] = await Promise.all([
      fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/sources/status`
      ).then((r) => r.json()),
      api.getDashboard().catch(() => null),
    ]);
    setSources(src);
    if (dash) setStats(dash);
    return `Ingested ${result.total_new} new articles from ${Object.keys(result.by_source).length} sources.`;
  };

  const groupedSources: Record<string, SourceStatus[]> = {};
  for (const s of sources) {
    const label =
      s.type === "news_scraper"
        ? "News Scrapers"
        : s.type === "rss_feed"
        ? "RSS Feeds"
        : s.type === "reddit"
        ? "Reddit"
        : s.type === "twitter"
        ? "Twitter / X"
        : s.type === "stock_data"
        ? "Stock Data"
        : "Other";
    if (!groupedSources[label]) groupedSources[label] = [];
    groupedSources[label].push(s);
  }

  const totalArticles = sources.reduce((sum, s) => sum + s.article_count, 0);
  const activeSources = sources.filter((s) => s.is_active).length;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 pb-24 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Step 1: News Sources
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Aggregating 200+ financial news sources into a unified feed
          </p>
        </div>
        <button
          onClick={() => setShowIngestModal(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Ingest Now
        </button>
      </div>

      {/* AI Market Narrative */}
      <MarketNarrative />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Sources"
          value={sources.length}
          color="blue"
        />
        <StatCard
          title="Active Sources"
          value={activeSources}
          subtitle={`${sources.length - activeSources} inactive`}
          color="emerald"
        />
        <StatCard
          title="Articles Ingested"
          value={totalArticles}
          color="amber"
        />
        <StatCard
          title="Signals Generated"
          value={stats?.total_signals ?? 0}
          subtitle={`${stats?.signals_today ?? 0} today`}
          color="purple"
        />
      </div>

      {/* Source Groups */}
      {loading ? (
        <div className="text-gray-400 text-center py-12">
          Loading sources...
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedSources).map(([group, items]) => (
            <div key={group}>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                {group}{" "}
                <span className="text-sm font-normal text-gray-400">
                  ({items.length})
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {items.map((source) => (
                  <div
                    key={source.name}
                    className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              source.is_active
                                ? "bg-emerald-500"
                                : "bg-red-400"
                            }`}
                          />
                          <h3 className="font-medium text-gray-900 text-sm truncate">
                            {source.name}
                          </h3>
                        </div>
                        <p className="text-xs text-gray-400 mt-1 truncate">
                          {source.url}
                        </p>
                        {source.error_message && (
                          <p className="text-xs text-red-500 mt-1">
                            {source.error_message}
                          </p>
                        )}
                        {source.accounts_tracked && (
                          <p className="text-xs text-gray-400 mt-1">
                            Tracking: {source.accounts_tracked.join(", ")}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="text-sm font-semibold text-gray-900">
                          {source.article_count}
                        </p>
                        <p className="text-xs text-gray-400">articles</p>
                      </div>
                    </div>
                    {source.last_scrape_time && (
                      <p className="text-xs text-gray-400 mt-2">
                        Last scraped:{" "}
                        {new Date(source.last_scrape_time).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View All Sources Link */}
      <div className="text-center pt-2">
        <Link
          href="/sources"
          className="text-sm text-emerald-600 hover:text-emerald-700 font-medium hover:underline transition-colors"
        >
          View Complete Sources Directory &rarr;
        </Link>
      </div>

      <ConfirmModal
        open={showIngestModal}
        title="Ingest News Articles"
        description="This will scrape all configured news sources (RSS feeds, web scrapers) and import new articles into the database. This may take 30-60 seconds depending on the number of sources."
        confirmLabel="Start Ingestion"
        confirmColor="emerald"
        onConfirm={handleIngest}
        onClose={() => setShowIngestModal(false)}
      />
    </div>
  );
}
