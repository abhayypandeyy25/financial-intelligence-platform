"use client";

import { useEffect, useState } from "react";
import { api, Article } from "@/lib/api";

export default function NewsPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState(false);
  const [sourceFilter, setSourceFilter] = useState("");
  const [processedFilter, setProcessedFilter] = useState<boolean | undefined>(undefined);

  const fetchArticles = () => {
    setLoading(true);
    const params: Record<string, string | boolean | number> = {};
    if (sourceFilter) params.source = sourceFilter;
    if (processedFilter !== undefined) params.processed = processedFilter;
    api
      .getNews(params)
      .then(setArticles)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchArticles();
    api.getSources().then(setSources).catch(console.error);
  }, [sourceFilter, processedFilter]);

  const handleIngest = async () => {
    setIngesting(true);
    try {
      const result = await api.triggerIngestion();
      alert(`Ingested ${result.total_new} new articles`);
      fetchArticles();
      api.getSources().then(setSources);
    } catch {
      alert("Ingestion failed. Check if the backend is running.");
    }
    setIngesting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">News Feed</h1>
          <p className="text-slate-400 text-sm mt-1">
            Aggregated financial news from Canadian sources
          </p>
        </div>
        <button
          onClick={handleIngest}
          disabled={ingesting}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
        >
          {ingesting ? "Ingesting..." : "Ingest News"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div>
          <label className="text-xs text-slate-400 block mb-1">Source</label>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">All Sources</option>
            {sources.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Status</label>
          <select
            value={processedFilter === undefined ? "" : String(processedFilter)}
            onChange={(e) =>
              setProcessedFilter(
                e.target.value === "" ? undefined : e.target.value === "true"
              )
            }
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value="true">Processed</option>
            <option value="false">Unprocessed</option>
          </select>
        </div>
      </div>

      {/* Articles */}
      {loading ? (
        <div className="text-slate-400 text-center py-12">Loading articles...</div>
      ) : articles.length === 0 ? (
        <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-slate-400">No articles found.</p>
          <p className="text-slate-500 text-sm mt-1">Click &quot;Ingest News&quot; to fetch articles from RSS feeds.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {articles.map((article) => (
            <div
              key={article.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white font-medium hover:text-blue-400 transition-colors"
                  >
                    {article.title}
                  </a>
                  {article.summary && (
                    <p className="text-slate-400 text-sm mt-1 line-clamp-2">
                      {article.summary}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                    <span className="px-2 py-0.5 rounded-full bg-slate-800">
                      {article.source}
                    </span>
                    {article.published_at && (
                      <span>{new Date(article.published_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full ml-3 ${
                    article.processed
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-slate-700 text-slate-400"
                  }`}
                >
                  {article.processed ? "Processed" : "Pending"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
