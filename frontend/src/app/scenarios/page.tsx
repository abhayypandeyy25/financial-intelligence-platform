"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, ScenarioHistory, ScenarioImpact, Top100Stock } from "@/lib/api";

const SECTORS = ["Energy", "Mining", "Finance", "Technology", "Healthcare"];

export default function ScenariosPage() {
  const searchParams = useSearchParams();
  const [scenarioText, setScenarioText] = useState("");
  const [selectedTickers, setSelectedTickers] = useState<string[]>([]);
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [maxRounds, setMaxRounds] = useState(15);
  const [tickerInput, setTickerInput] = useState("");
  const [stocks, setStocks] = useState<Top100Stock[]>([]);
  const [history, setHistory] = useState<ScenarioHistory[]>([]);
  const [running, setRunning] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [activeScenario, setActiveScenario] = useState<number | null>(null);
  const [impacts, setImpacts] = useState<ScenarioImpact[]>([]);

  useEffect(() => {
    api.getTop100Stocks().then(setStocks).catch(() => {});
    api.getScenarioHistory().then(setHistory).catch(() => {});
    const ticker = searchParams.get("ticker");
    if (ticker) setSelectedTickers([ticker]);
  }, [searchParams]);

  // Poll task status
  useEffect(() => {
    if (!taskId) return;
    const interval = setInterval(async () => {
      try {
        const status = await api.getScenarioStatus(taskId);
        setProgress(status.progress);
        setStatusMessage(status.message);
        if (status.status === "completed") {
          setRunning(false);
          setTaskId(null);
          if (status.simulation_id) {
            setActiveScenario(status.simulation_id as number);
            const impactData = await api.getScenarioImpacts(status.simulation_id as number);
            setImpacts(impactData);
          }
          api.getScenarioHistory().then(setHistory).catch(() => {});
        } else if (status.status === "failed") {
          setRunning(false);
          setTaskId(null);
        }
      } catch {
        // ignore
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [taskId]);

  const handleRun = async () => {
    if (!scenarioText.trim()) return;
    try {
      setRunning(true);
      setProgress(0);
      setStatusMessage("Starting...");
      setImpacts([]);
      setActiveScenario(null);
      const result = await api.runScenario(
        scenarioText,
        selectedTickers.length > 0 ? selectedTickers : undefined,
        selectedSectors.length > 0 ? selectedSectors : undefined,
        maxRounds
      );
      setTaskId(result.task_id);
    } catch (e) {
      setRunning(false);
      setStatusMessage(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
    }
  };

  const addTicker = () => {
    const t = tickerInput.trim().toUpperCase();
    if (t && !selectedTickers.includes(t)) {
      setSelectedTickers([...selectedTickers, t]);
    }
    setTickerInput("");
  };

  const viewPastScenario = async (id: number) => {
    setActiveScenario(id);
    try {
      const impactData = await api.getScenarioImpacts(id);
      setImpacts(impactData);
    } catch {
      setImpacts([]);
    }
  };

  const filteredStocks = tickerInput
    ? stocks.filter(
        (s) =>
          s.ticker.toLowerCase().includes(tickerInput.toLowerCase()) ||
          s.company_name.toLowerCase().includes(tickerInput.toLowerCase())
      ).slice(0, 5)
    : [];

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Market Scenario Simulator</h1>
        <p className="text-sm text-gray-400 mt-1">
          Describe a hypothetical market event and simulate how agents would react
        </p>
      </div>

      {/* Scenario input form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">
            Describe your scenario
          </label>
          <textarea
            value={scenarioText}
            onChange={(e) => setScenarioText(e.target.value)}
            rows={3}
            placeholder='e.g., "What if oil prices drop 20% due to an OPEC decision to increase production?"'
            className="w-full text-sm border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
          />
        </div>

        {/* Ticker selection */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">
            Target Stocks <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedTickers.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 text-xs px-2.5 py-1 rounded-full"
              >
                {t}
                <button
                  onClick={() => setSelectedTickers(selectedTickers.filter((x) => x !== t))}
                  className="text-purple-400 hover:text-purple-600"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
          <div className="relative">
            <input
              type="text"
              value={tickerInput}
              onChange={(e) => setTickerInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTicker())}
              placeholder="Add ticker (e.g., ENB.TO)"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            {filteredStocks.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {filteredStocks.map((s) => (
                  <button
                    key={s.ticker}
                    onClick={() => {
                      if (!selectedTickers.includes(s.ticker))
                        setSelectedTickers([...selectedTickers, s.ticker]);
                      setTickerInput("");
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex justify-between"
                  >
                    <span className="font-medium">{s.ticker}</span>
                    <span className="text-gray-400">{s.company_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sectors */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Sectors</label>
          <div className="flex flex-wrap gap-2">
            {SECTORS.map((s) => (
              <button
                key={s}
                onClick={() =>
                  setSelectedSectors(
                    selectedSectors.includes(s)
                      ? selectedSectors.filter((x) => x !== s)
                      : [...selectedSectors, s]
                  )
                }
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  selectedSectors.includes(s)
                    ? "bg-purple-600 text-white border-purple-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-purple-300"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Settings + Run */}
        <div className="flex items-end justify-between pt-2">
          <div className="flex gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Rounds</label>
              <select
                value={maxRounds}
                onChange={(e) => setMaxRounds(Number(e.target.value))}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2"
              >
                {[5, 10, 15, 20, 30].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={handleRun}
            disabled={running || !scenarioText.trim()}
            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {running ? "Running..." : "Run Simulation"}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {running && (
        <div className="bg-purple-50 rounded-xl border border-purple-100 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-1 bg-purple-200 rounded-full h-2.5">
              <div
                className="bg-purple-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-sm font-medium text-purple-700">{progress}%</span>
          </div>
          <p className="text-xs text-purple-600">{statusMessage}</p>
        </div>
      )}

      {/* Impact results */}
      {impacts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Impact Predictions</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Ticker</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Direction</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Magnitude</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Confidence</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Reasoning</th>
                </tr>
              </thead>
              <tbody>
                {impacts.map((impact) => (
                  <tr key={impact.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 px-3 font-medium">{impact.ticker}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          impact.predicted_direction === "up"
                            ? "bg-emerald-50 text-emerald-600"
                            : impact.predicted_direction === "down"
                            ? "bg-red-50 text-red-600"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {impact.predicted_direction === "up"
                          ? "↑ Up"
                          : impact.predicted_direction === "down"
                          ? "↓ Down"
                          : "— Neutral"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {impact.predicted_magnitude !== null
                        ? `${impact.predicted_magnitude > 0 ? "+" : ""}${impact.predicted_magnitude.toFixed(1)}%`
                        : "—"}
                    </td>
                    <td className="py-2.5 px-3">
                      {impact.confidence !== null ? `${(impact.confidence * 100).toFixed(0)}%` : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 text-xs max-w-xs truncate">
                      {impact.reasoning || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Past scenarios */}
      {history.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Past Scenarios</h2>
          <div className="space-y-2">
            {history.map((s) => (
              <button
                key={s.id}
                onClick={() => viewPastScenario(s.id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  activeScenario === s.id
                    ? "border-purple-200 bg-purple-50"
                    : "border-gray-100 hover:bg-gray-50"
                }`}
              >
                <p className="text-sm font-medium text-gray-900 truncate">
                  {s.scenario_description || "Unnamed scenario"}
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  <span
                    className={`px-1.5 py-0.5 rounded ${
                      s.status === "completed"
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {s.status}
                  </span>
                  {s.created_at && <span>{new Date(s.created_at).toLocaleDateString()}</span>}
                  <span>{s.impact_count} impacts</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
