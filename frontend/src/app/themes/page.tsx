"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Theme, Ontology } from "@/lib/api";

export default function ThemesPage() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [ontology, setOntology] = useState<Ontology | null>(null);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);

  const fetchData = () => {
    setLoading(true);
    Promise.all([api.getThemes(30), api.getOntology()])
      .then(([t, o]) => {
        setThemes(t);
        setOntology(o);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDetect = async () => {
    setDetecting(true);
    try {
      const result = await api.detectThemes();
      alert(`Detected ${result.themes_detected} themes`);
      fetchData();
    } catch {
      alert("Theme detection failed. Check backend.");
    }
    setDetecting(false);
  };

  if (loading) {
    return <div className="text-slate-400 text-center py-12">Loading themes...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Themes & Ontology</h1>
          <p className="text-slate-400 text-sm mt-1">
            Investment themes detected from news analysis
          </p>
        </div>
        <button
          onClick={handleDetect}
          disabled={detecting}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
        >
          {detecting ? "Detecting..." : "Detect Themes"}
        </button>
      </div>

      {/* Ontology */}
      {ontology && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-4">Ontology Framework</h2>
          <p className="text-slate-400 text-sm mb-4">
            The structured taxonomy for classifying investment insights in the Canadian market.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <h3 className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2">
                Sectors
              </h3>
              <div className="space-y-1">
                {ontology.sectors.map((s) => (
                  <span
                    key={s}
                    className="block text-sm px-2 py-1 rounded bg-blue-500/10 text-blue-300"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2">
                Geography
              </h3>
              <div className="space-y-1">
                {ontology.geographies.map((g) => (
                  <span
                    key={g}
                    className="block text-sm px-2 py-1 rounded bg-emerald-500/10 text-emerald-300"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2">
                Exchanges
              </h3>
              <div className="space-y-1">
                {ontology.exchanges.map((e) => (
                  <span
                    key={e}
                    className="block text-sm px-2 py-1 rounded bg-amber-500/10 text-amber-300"
                  >
                    {e}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2">
                Asset Classes
              </h3>
              <div className="space-y-1">
                {ontology.asset_classes.map((a) => (
                  <span
                    key={a}
                    className="block text-sm px-2 py-1 rounded bg-purple-500/10 text-purple-300"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2">
                Insight Types
              </h3>
              <div className="space-y-1">
                {ontology.insight_types.map((i) => (
                  <span
                    key={i}
                    className="block text-sm px-2 py-1 rounded bg-red-500/10 text-red-300"
                  >
                    {i}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Themes */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Active Investment Themes</h2>
        {themes.length === 0 ? (
          <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-xl">
            <p className="text-slate-400">No themes detected yet.</p>
            <p className="text-slate-500 text-sm mt-1">
              Process articles first, then click &quot;Detect Themes&quot; to identify patterns.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {themes.map((theme) => (
              <Link
                key={theme.id}
                href={`/themes/${theme.id}`}
                className="block bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-white">{theme.name}</h3>
                  {theme.relevance_score && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                      {(theme.relevance_score * 100).toFixed(0)}% relevant
                    </span>
                  )}
                </div>
                {theme.description && (
                  <p className="text-slate-400 text-sm mt-2">{theme.description}</p>
                )}
                <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
                  {theme.sector && (
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300">
                      {theme.sector}
                    </span>
                  )}
                  <span>{theme.article_count} articles</span>
                  {theme.created_at && (
                    <span>{new Date(theme.created_at).toLocaleDateString()}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
