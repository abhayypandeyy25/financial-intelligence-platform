"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, Top100Stock, StockQuote } from "@/lib/api";
import StatCard from "@/components/StatCard";

const SECTOR_COLORS: Record<string, string> = {
  Finance: "bg-blue-500/10 text-blue-400",
  Energy: "bg-amber-500/10 text-amber-400",
  Mining: "bg-purple-500/10 text-purple-400",
  Technology: "bg-emerald-500/10 text-emerald-400",
  Healthcare: "bg-red-500/10 text-red-400",
  Other: "bg-slate-500/10 text-slate-400",
};

export default function StocksPage() {
  const router = useRouter();
  const [stocks, setStocks] = useState<Top100Stock[]>([]);
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sectorFilter, setSectorFilter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [stocksData, quotesData] = await Promise.all([
        api.getTop100Stocks(),
        api.getStockQuotes({ limit: 200 }),
      ]);
      setStocks(stocksData);

      // Index quotes by ticker (latest per ticker)
      const quoteMap: Record<string, StockQuote> = {};
      for (const q of quotesData) {
        const existing = quoteMap[q.ticker];
        if (!existing || (q.ingested_at && existing.ingested_at && q.ingested_at > existing.ingested_at)) {
          quoteMap[q.ticker] = q;
        }
      }
      setQuotes(quoteMap);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const result = await api.refreshStockQuotes();
      // Reload quotes after refresh
      const quotesData = await api.getStockQuotes({ limit: 200 });
      const quoteMap: Record<string, StockQuote> = {};
      for (const q of quotesData) {
        const existing = quoteMap[q.ticker];
        if (!existing || (q.ingested_at && existing.ingested_at && q.ingested_at > existing.ingested_at)) {
          quoteMap[q.ticker] = q;
        }
      }
      setQuotes(quoteMap);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading stocks...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
        <h2 className="text-red-400 font-semibold">Error</h2>
        <p className="text-slate-400 mt-1 text-sm">{error}</p>
      </div>
    );
  }

  // Get unique sectors
  const sectors = Array.from(new Set(stocks.map((s) => s.sector).filter(Boolean))) as string[];

  // Filter stocks
  const filtered = stocks.filter((s) => {
    if (sectorFilter && s.sector !== sectorFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        s.ticker.toLowerCase().includes(term) ||
        s.company_name.toLowerCase().includes(term)
      );
    }
    return true;
  });

  // Compute stats
  const quotedStocks = Object.values(quotes);
  const gainers = quotedStocks.filter((q) => q.percent_change && q.percent_change > 0);
  const losers = quotedStocks.filter((q) => q.percent_change && q.percent_change < 0);
  const topGainer = gainers.sort((a, b) => (b.percent_change || 0) - (a.percent_change || 0))[0];
  const topLoser = losers.sort((a, b) => (a.percent_change || 0) - (b.percent_change || 0))[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">TSX Stocks</h1>
          <p className="text-slate-400 text-sm mt-1">
            Top {stocks.length} TSX stocks with real-time quotes
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {refreshing ? "Refreshing..." : "Refresh Quotes"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Stocks" value={stocks.length} color="blue" />
        <StatCard
          title="With Quotes"
          value={quotedStocks.length}
          subtitle={quotedStocks.length > 0 ? `Last: ${new Date(quotedStocks[0]?.ingested_at || "").toLocaleTimeString()}` : undefined}
          color="emerald"
        />
        <StatCard
          title="Top Gainer"
          value={topGainer ? `${topGainer.ticker.replace(".TO", "")}` : "N/A"}
          subtitle={topGainer ? `+${topGainer.percent_change?.toFixed(2)}%` : undefined}
          color="emerald"
        />
        <StatCard
          title="Top Loser"
          value={topLoser ? `${topLoser.ticker.replace(".TO", "")}` : "N/A"}
          subtitle={topLoser ? `${topLoser.percent_change?.toFixed(2)}%` : undefined}
          color="red"
        />
      </div>

      {/* Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap gap-4 items-center">
        <input
          type="text"
          placeholder="Search ticker or company..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 flex-1 min-w-[200px]"
        />
        <select
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
        >
          <option value="">All Sectors</option>
          {sectors.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Stock Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800 text-left text-xs text-slate-400 uppercase tracking-wider">
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Ticker</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Sector</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Change</th>
              <th className="px-4 py-3 text-right">% Change</th>
              <th className="px-4 py-3 text-right">Volume</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  No stocks found matching your filters.
                </td>
              </tr>
            ) : (
              filtered.map((stock) => {
                const quote = quotes[stock.ticker];
                const changeColor =
                  quote?.percent_change && quote.percent_change > 0
                    ? "text-emerald-400"
                    : quote?.percent_change && quote.percent_change < 0
                    ? "text-red-400"
                    : "text-slate-400";

                return (
                  <tr
                    key={stock.ticker}
                    onClick={() => router.push(`/stocks/${stock.ticker}`)}
                    className="border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {stock.market_cap_rank}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-semibold text-emerald-400">
                        {stock.ticker.replace(".TO", "")}
                      </span>
                      <span className="text-slate-600 text-xs ml-1">.TO</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {stock.company_name}
                    </td>
                    <td className="px-4 py-3">
                      {stock.sector && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            SECTOR_COLORS[stock.sector] || SECTOR_COLORS.Other
                          }`}
                        >
                          {stock.sector}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-mono">
                      {quote?.current_price
                        ? `$${quote.current_price.toFixed(2)}`
                        : "--"}
                    </td>
                    <td className={`px-4 py-3 text-right text-sm font-mono ${changeColor}`}>
                      {quote?.price_change != null
                        ? `${quote.price_change > 0 ? "+" : ""}${quote.price_change.toFixed(2)}`
                        : "--"}
                    </td>
                    <td className={`px-4 py-3 text-right text-sm font-mono font-semibold ${changeColor}`}>
                      {quote?.percent_change != null
                        ? `${quote.percent_change > 0 ? "+" : ""}${quote.percent_change.toFixed(2)}%`
                        : "--"}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-slate-400 font-mono">
                      {quote?.volume
                        ? quote.volume >= 1_000_000
                          ? `${(quote.volume / 1_000_000).toFixed(1)}M`
                          : quote.volume >= 1_000
                          ? `${(quote.volume / 1_000).toFixed(0)}K`
                          : quote.volume.toLocaleString()
                        : "--"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
