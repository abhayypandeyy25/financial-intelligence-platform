"use client";

import { useEffect, useState } from "react";
import { api, Ontology, Article, Signal } from "@/lib/api";
import { useStep } from "@/context/StepContext";

export default function OntologyPanel() {
  const { setActiveStep } = useStep();
  const [ontology, setOntology] = useState<Ontology | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState("");
  const [processedFilter, setProcessedFilter] = useState<boolean | undefined>(
    undefined
  );
  const [sources, setSources] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      api.getOntology().catch(() => null),
      api.getNews({ limit: 50 }).catch(() => []),
      api.getSignals().catch(() => []),
      api.getSources().catch(() => []),
    ])
      .then(([o, a, s, src]) => {
        setOntology(o);
        setArticles(a);
        setSignals(s);
        setSources(src);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const params: Record<string, string | boolean | number> = { limit: 50 };
    if (sourceFilter) params.source = sourceFilter;
    if (processedFilter !== undefined) params.processed = processedFilter;
    api
      .getNews(params)
      .then(setArticles)
      .catch(() => {});
  }, [sourceFilter, processedFilter]);

  if (loading) {
    return (
      <div className="text-gray-400 text-center py-12">
        Loading ontology...
      </div>
    );
  }

  // Filter signals by selected sector
  const sectorSignals = selectedSector
    ? signals.filter((s) => s.sector === selectedSector)
    : signals;

  // Sector stats
  const sectorStats = ontology?.sectors.map((sector) => {
    const count = signals.filter((s) => s.sector === sector).length;
    const articles_count = 0; // Would need article-sector mapping
    return { sector, signalCount: count, articleCount: articles_count };
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 pb-24 lg:pb-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Step 2: Intelligent Filtering & Ontology
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Structured taxonomy for classifying investment insights — Sector,
          Geography, Asset Class, Insight Type
        </p>
      </div>

      {/* Ontology Framework */}
      {ontology && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Ontology Framework
          </h2>
          <p className="text-gray-500 text-sm mb-4">
            The structured worldview for classifying investment intelligence.
            Click a sector to filter signals below.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* Sectors */}
            <div>
              <h3 className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">
                Sectors
              </h3>
              <div className="space-y-1">
                {ontology.sectors.map((s) => (
                  <button
                    key={s}
                    onClick={() =>
                      setSelectedSector(selectedSector === s ? null : s)
                    }
                    className={`block w-full text-left text-sm px-2 py-1 rounded transition-colors ${
                      selectedSector === s
                        ? "bg-blue-100 text-blue-700 font-medium"
                        : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                    }`}
                  >
                    {s}
                    {sectorStats && (
                      <span className="text-xs text-blue-400 ml-1">
                        (
                        {sectorStats.find((st) => st.sector === s)
                          ?.signalCount ?? 0}
                        )
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Geography */}
            <div>
              <h3 className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">
                Geography
              </h3>
              <div className="space-y-1">
                {ontology.geographies.map((g) => (
                  <span
                    key={g}
                    className="block text-sm px-2 py-1 rounded bg-emerald-50 text-emerald-600"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>

            {/* Exchanges */}
            <div>
              <h3 className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">
                Exchanges
              </h3>
              <div className="space-y-1">
                {ontology.exchanges.map((e) => (
                  <span
                    key={e}
                    className="block text-sm px-2 py-1 rounded bg-amber-50 text-amber-600"
                  >
                    {e}
                  </span>
                ))}
              </div>
            </div>

            {/* Asset Classes */}
            <div>
              <h3 className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">
                Asset Classes
              </h3>
              <div className="space-y-1">
                {ontology.asset_classes.map((a) => (
                  <span
                    key={a}
                    className="block text-sm px-2 py-1 rounded bg-purple-50 text-purple-600"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>

            {/* Insight Types */}
            <div>
              <h3 className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">
                Insight Types
              </h3>
              <div className="space-y-1">
                {ontology.insight_types.map((i) => (
                  <span
                    key={i}
                    className="block text-sm px-2 py-1 rounded bg-red-50 text-red-600"
                  >
                    {i}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sector Signal Preview */}
      {selectedSector && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            {selectedSector} Sector Signals ({sectorSignals.length})
          </h2>
          {sectorSignals.length === 0 ? (
            <p className="text-gray-400 text-sm">
              No signals found for this sector.
            </p>
          ) : (
            <div className="space-y-2">
              {sectorSignals.slice(0, 5).map((signal) => (
                <div
                  key={signal.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-emerald-600">
                      {signal.stock_ticker}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        signal.direction === "up"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {signal.direction?.toUpperCase()}
                    </span>
                    <span className="text-gray-500 text-xs">
                      {signal.reasoning?.slice(0, 80)}...
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">
                    {(signal.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Articles Feed */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Classified Articles ({articles.length})
          </h2>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Source</label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900"
            >
              <option value="">All Sources</option>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Status</label>
            <select
              value={
                processedFilter === undefined ? "" : String(processedFilter)
              }
              onChange={(e) =>
                setProcessedFilter(
                  e.target.value === ""
                    ? undefined
                    : e.target.value === "true"
                )
              }
              className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900"
            >
              <option value="">All</option>
              <option value="true">Processed</option>
              <option value="false">Unprocessed</option>
            </select>
          </div>
        </div>

        {/* Articles list */}
        {!loading && articles.length === 0 && (
          <div className="text-center py-12 bg-gray-50 border border-gray-200 rounded-xl">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="text-gray-500 font-medium">No articles ingested yet</p>
            <p className="text-gray-400 text-sm mt-1">
              Go to Sources (Step 1) and click &quot;Ingest Now&quot; to pull articles from configured news sources.
            </p>
            <button
              onClick={() => setActiveStep(1)}
              className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Go to Sources
            </button>
          </div>
        )}
        <div className="space-y-2">
          {articles.map((article) => (
            <div
              key={article.id}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-900 font-medium hover:text-blue-600 transition-colors text-sm"
                  >
                    {article.title}
                  </a>
                  {article.summary && (
                    <p className="text-gray-500 text-sm mt-1 line-clamp-2">
                      {article.summary}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {article.source}
                    </span>
                    {article.published_at && (
                      <span>
                        {new Date(article.published_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full ml-3 ${
                    article.processed
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {article.processed ? "Processed" : "Pending"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
