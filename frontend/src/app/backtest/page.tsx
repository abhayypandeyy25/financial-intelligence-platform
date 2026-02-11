"use client";

import { useEffect, useState } from "react";
import { api, BacktestResult, BacktestSummary } from "@/lib/api";
import StatCard from "@/components/StatCard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function BacktestPage() {
  const [summary, setSummary] = useState<BacktestSummary | null>(null);
  const [results, setResults] = useState<BacktestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const fetchData = () => {
    setLoading(true);
    Promise.all([api.getBacktestSummary(), api.getBacktestResults()])
      .then(([s, r]) => {
        setSummary(s);
        setResults(r);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRun = async () => {
    setRunning(true);
    try {
      const result = await api.runBacktest();
      alert(`Tested ${result.signals_tested} signals, created ${result.results_created} results`);
      fetchData();
    } catch {
      alert("Back-test failed. Check backend.");
    }
    setRunning(false);
  };

  if (loading) {
    return <div className="text-slate-400 text-center py-12">Loading back-test data...</div>;
  }

  const sectorAccuracyData = summary
    ? Object.entries(summary.by_sector).map(([sector, data]) => ({
        sector,
        accuracy_1d: data.accuracy_1d || 0,
        accuracy_7d: data.accuracy_7d || 0,
        total: data.total || 0,
      }))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Back-test Results</h1>
          <p className="text-slate-400 text-sm mt-1">
            Signal validation against actual TSX market data
          </p>
        </div>
        <button
          onClick={handleRun}
          disabled={running}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
        >
          {running ? "Running..." : "Run Back-tests"}
        </button>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Signals Tested"
            value={summary.total_signals_tested}
            color="blue"
          />
          <StatCard
            title="1-Day Accuracy"
            value={summary.accuracy_1d ? `${summary.accuracy_1d}%` : "N/A"}
            color="emerald"
          />
          <StatCard
            title="7-Day Accuracy"
            value={summary.accuracy_7d ? `${summary.accuracy_7d}%` : "N/A"}
            color="amber"
          />
          <StatCard
            title="Avg Confidence"
            value={summary.avg_confidence ? `${(summary.avg_confidence * 100).toFixed(0)}%` : "N/A"}
            color="purple"
          />
        </div>
      )}

      {/* Accuracy by Sector */}
      {sectorAccuracyData.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-4">Accuracy by Sector</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sectorAccuracyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="sector" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="accuracy_1d" name="1-Day" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="accuracy_7d" name="7-Day" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Results Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold mb-4">Individual Results</h2>
        {results.length === 0 ? (
          <p className="text-slate-500 text-sm">No back-test results yet. Run back-tests to validate signals.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="text-left py-2 px-3">Ticker</th>
                  <th className="text-left py-2 px-3">Predicted</th>
                  <th className="text-right py-2 px-3">Price</th>
                  <th className="text-right py-2 px-3">1D Change</th>
                  <th className="text-right py-2 px-3">7D Change</th>
                  <th className="text-right py-2 px-3">30D Change</th>
                  <th className="text-center py-2 px-3">1D</th>
                  <th className="text-center py-2 px-3">7D</th>
                  <th className="text-center py-2 px-3">30D</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="py-2 px-3 font-mono font-semibold">{r.ticker}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          r.direction_predicted === "up"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {r.direction_predicted.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-slate-300">
                      ${r.price_at_signal?.toFixed(2)}
                    </td>
                    <td className={`py-2 px-3 text-right ${(r.actual_1d_change ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {r.actual_1d_change != null ? `${r.actual_1d_change > 0 ? "+" : ""}${r.actual_1d_change.toFixed(2)}%` : "-"}
                    </td>
                    <td className={`py-2 px-3 text-right ${(r.actual_7d_change ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {r.actual_7d_change != null ? `${r.actual_7d_change > 0 ? "+" : ""}${r.actual_7d_change.toFixed(2)}%` : "-"}
                    </td>
                    <td className={`py-2 px-3 text-right ${(r.actual_30d_change ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {r.actual_30d_change != null ? `${r.actual_30d_change > 0 ? "+" : ""}${r.actual_30d_change.toFixed(2)}%` : "-"}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {r.accurate_1d != null ? (r.accurate_1d ? "✓" : "✗") : "-"}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {r.accurate_7d != null ? (r.accurate_7d ? "✓" : "✗") : "-"}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {r.accurate_30d != null ? (r.accurate_30d ? "✓" : "✗") : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
