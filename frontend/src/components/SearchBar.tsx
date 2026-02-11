"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { api, SearchResults } from "@/lib/api";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults(null);
      setOpen(false);
      return;
    }

    setLoading(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      api
        .search(query, 4)
        .then((r) => {
          setResults(r);
          setOpen(true);
        })
        .catch(() => setResults(null))
        .finally(() => setLoading(false));
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function navigate(path: string) {
    setOpen(false);
    setQuery("");
    router.push(path);
  }

  const hasResults =
    results &&
    (results.stocks.length > 0 ||
      results.signals.length > 0 ||
      results.articles.length > 0 ||
      results.themes.length > 0);

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results && setOpen(true)}
        placeholder="Search stocks, signals, news..."
        className="w-48 lg:w-64 bg-slate-800 border border-slate-600 rounded-md px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {loading && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <div className="animate-spin h-4 w-4 border-2 border-emerald-500 border-t-transparent rounded-full" />
        </div>
      )}

      {/* Dropdown */}
      {open && results && (
        <div className="absolute top-full mt-1 left-0 w-80 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          {!hasResults && (
            <p className="text-sm text-slate-400 p-3">No results for &quot;{query}&quot;</p>
          )}

          {results.stocks.length > 0 && (
            <div className="p-2">
              <p className="text-xs text-slate-500 px-2 pb-1 font-semibold uppercase">Stocks</p>
              {results.stocks.map((s) => (
                <button
                  key={s.id}
                  onClick={() => navigate(`/stocks/${s.ticker}`)}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-700 transition-colors"
                >
                  <span className="font-mono text-emerald-400 text-sm">{s.ticker}</span>
                  <span className="text-slate-300 text-sm ml-2">{s.company_name}</span>
                  {s.sector && <span className="text-xs text-slate-500 ml-2">{s.sector}</span>}
                </button>
              ))}
            </div>
          )}

          {results.signals.length > 0 && (
            <div className="p-2 border-t border-slate-700">
              <p className="text-xs text-slate-500 px-2 pb-1 font-semibold uppercase">Signals</p>
              {results.signals.map((s) => (
                <button
                  key={s.id}
                  onClick={() => navigate(`/signals/${s.id}`)}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-700 transition-colors"
                >
                  <span className="font-mono text-emerald-400 text-sm">{s.stock_ticker}</span>
                  <span
                    className={`text-xs ml-2 ${
                      s.direction === "up" ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {s.direction?.toUpperCase()}
                  </span>
                  <span className="text-xs text-slate-400 ml-2">
                    {(s.confidence * 100).toFixed(0)}%
                  </span>
                </button>
              ))}
            </div>
          )}

          {results.articles.length > 0 && (
            <div className="p-2 border-t border-slate-700">
              <p className="text-xs text-slate-500 px-2 pb-1 font-semibold uppercase">Articles</p>
              {results.articles.map((a) => (
                <button
                  key={a.id}
                  onClick={() => navigate(`/news`)}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-700 transition-colors"
                >
                  <p className="text-sm text-slate-300 line-clamp-1">{a.title}</p>
                  <p className="text-xs text-slate-500">{a.source}</p>
                </button>
              ))}
            </div>
          )}

          {results.themes.length > 0 && (
            <div className="p-2 border-t border-slate-700">
              <p className="text-xs text-slate-500 px-2 pb-1 font-semibold uppercase">Themes</p>
              {results.themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => navigate(`/themes/${t.id}`)}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-700 transition-colors"
                >
                  <p className="text-sm text-slate-300">{t.name}</p>
                  {t.sector && <span className="text-xs text-slate-500">{t.sector}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
