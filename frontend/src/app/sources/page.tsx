"use client";

import { useEffect, useState } from "react";
import { api, DashboardSummary } from "@/lib/api";
import StatCard from "@/components/StatCard";
import DetailNav from "@/components/DetailNav";
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

const TYPE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  news_scraper: {
    label: "News Scrapers",
    color: "bg-blue-50 border-blue-200 text-blue-700",
    icon: "Web scraping financial news sites for articles",
  },
  rss_feed: {
    label: "RSS Feeds",
    color: "bg-emerald-50 border-emerald-200 text-emerald-700",
    icon: "Automated RSS feed ingestion for real-time news",
  },
  reddit: {
    label: "Reddit",
    color: "bg-amber-50 border-amber-200 text-amber-700",
    icon: "Community sentiment from Canadian investing subreddits",
  },
  twitter: {
    label: "Twitter / X",
    color: "bg-purple-50 border-purple-200 text-purple-700",
    icon: "Financial accounts and keyword tracking on X",
  },
  stock_data: {
    label: "Stock Data",
    color: "bg-gray-50 border-gray-200 text-gray-700",
    icon: "Live stock quotes and historical price data",
  },
};

export default function SourcesPage() {
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [stats, setStats] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
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

  // Group sources by type
  const grouped: Record<string, SourceStatus[]> = {};
  for (const s of sources) {
    const type = s.type || "other";
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(s);
  }

  const totalArticles = sources.reduce((sum, s) => sum + s.article_count, 0);
  const activeSources = sources.filter((s) => s.is_active).length;
  const inactiveSources = sources.length - activeSources;

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
          <div className="h-64 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 pb-24 lg:pb-6">
      {/* Navigation */}
      <DetailNav backLabel="Back to Sources" backStep={1} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sources Directory</h1>
          <p className="text-gray-500 text-sm mt-1">
            Complete list of all configured data sources and their current status
          </p>
        </div>
        <button
          onClick={() => setShowIngestModal(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Ingest Now
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard title="Total Sources" value={sources.length} color="blue" />
        <StatCard
          title="Active"
          value={activeSources}
          subtitle={`${inactiveSources} inactive`}
          color="emerald"
        />
        <StatCard title="Articles" value={totalArticles.toLocaleString()} color="amber" />
        <StatCard
          title="Signals"
          value={stats?.total_signals ?? 0}
          subtitle={`${stats?.signals_today ?? 0} today`}
          color="purple"
        />
        <StatCard
          title="Themes"
          value={stats?.active_themes ?? 0}
          color="red"
        />
      </div>

      {/* Source Groups */}
      <div className="space-y-8">
        {Object.entries(grouped).map(([type, items]) => {
          const meta = TYPE_LABELS[type] || {
            label: type,
            color: "bg-gray-50 border-gray-200 text-gray-700",
            icon: "",
          };
          return (
            <div key={type}>
              {/* Group Header */}
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-lg font-semibold text-gray-900">
                  {meta.label}
                </h2>
                <span className="text-sm text-gray-400">
                  {items.length} source{items.length !== 1 ? "s" : ""}
                </span>
              </div>
              <p className="text-sm text-gray-500 mb-4">{meta.icon}</p>

              {/* Source Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((source) => (
                  <div
                    key={source.name}
                    className={`rounded-xl border p-4 transition-colors ${
                      source.is_active
                        ? "bg-white border-gray-200 hover:border-gray-300"
                        : "bg-gray-50 border-gray-200 opacity-75"
                    }`}
                  >
                    {/* Name + Status */}
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          source.is_active ? "bg-emerald-500" : "bg-red-400"
                        }`}
                      />
                      <h3 className="font-medium text-gray-900 text-sm truncate">
                        {source.name}
                      </h3>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ml-auto shrink-0 ${
                          source.is_active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-600"
                        }`}
                      >
                        {source.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>

                    {/* URL */}
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline truncate block"
                    >
                      {source.url}
                    </a>

                    {/* Error */}
                    {source.error_message && (
                      <p className="text-xs text-red-500 mt-2 bg-red-50 px-2 py-1 rounded">
                        {source.error_message}
                      </p>
                    )}

                    {/* Accounts tracked (Twitter) */}
                    {source.accounts_tracked && source.accounts_tracked.length > 0 && (
                      <p className="text-xs text-gray-400 mt-2">
                        Tracking: {source.accounts_tracked.slice(0, 5).join(", ")}
                        {source.accounts_tracked.length > 5 && ` +${source.accounts_tracked.length - 5} more`}
                      </p>
                    )}

                    {/* Stats Row */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                      <div>
                        <p className="text-lg font-bold text-gray-900">
                          {source.article_count.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                          {type === "reddit" || type === "twitter" ? "posts" : "articles"}
                        </p>
                      </div>
                      {source.last_scrape_time && (
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Last scraped</p>
                          <p className="text-xs text-gray-700 font-medium">
                            {new Date(source.last_scrape_time).toLocaleDateString("en-CA", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      )}
                      {!source.last_scrape_time && (
                        <p className="text-xs text-gray-400 italic">Never scraped</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
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
