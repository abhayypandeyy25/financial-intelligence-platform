"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ForceGraph from "@/components/ForceGraph";
import { api, GraphData, GraphNode } from "@/lib/api";

type ViewMode = "graph" | "split" | "list";

export default function KnowledgeGraphPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [buildTaskId, setBuildTaskId] = useState<string | null>(null);
  const [buildProgress, setBuildProgress] = useState(0);
  const [buildMessage, setBuildMessage] = useState("");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [sectorFilter, setSectorFilter] = useState(searchParams.get("sector") || "");
  const [tickerFilter] = useState(searchParams.get("focus") || "");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchGraphData = useCallback(async () => {
    try {
      setLoading(true);
      const params: { sector?: string; ticker?: string } = {};
      if (sectorFilter) params.sector = sectorFilter;
      if (tickerFilter) params.ticker = tickerFilter;
      const data = await api.getGraphData(params);
      setGraphData(data);
    } catch {
      setGraphData(null);
    } finally {
      setLoading(false);
    }
  }, [sectorFilter, tickerFilter]);

  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);

  // Poll build status
  useEffect(() => {
    if (!buildTaskId) return;
    const interval = setInterval(async () => {
      try {
        const status = await api.getKGBuildStatus(buildTaskId);
        setBuildProgress(status.progress);
        setBuildMessage(status.message);
        if (status.status === "completed") {
          setBuilding(false);
          setBuildTaskId(null);
          fetchGraphData();
        } else if (status.status === "failed") {
          setBuilding(false);
          setBuildTaskId(null);
          setBuildMessage(`Failed: ${status.error || status.message}`);
        }
      } catch {
        // ignore poll errors
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [buildTaskId, fetchGraphData]);

  const handleBuild = async () => {
    try {
      setBuilding(true);
      setBuildProgress(0);
      setBuildMessage("Starting build...");
      const result = await api.buildKnowledgeGraph();
      setBuildTaskId(result.task_id);
    } catch (e) {
      setBuilding(false);
      setBuildMessage(`Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  };

  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(node);
    if (viewMode === "graph") setViewMode("split");
  };

  const sectors = ["Finance", "Energy", "Mining", "Technology", "Healthcare"];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Knowledge Graph Explorer</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {graphData
              ? `${graphData.node_count} nodes, ${graphData.edge_count} edges`
              : "Interactive financial entity relationships"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1 gap-0.5">
            {(["graph", "split", "list"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  viewMode === mode
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {/* Edge labels toggle */}
          <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={showEdgeLabels}
              onChange={(e) => setShowEdgeLabels(e.target.checked)}
              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            Labels
          </label>

          {/* Build button */}
          <button
            onClick={handleBuild}
            disabled={building}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-300 text-white text-xs font-medium rounded-lg transition-colors"
          >
            {building ? "Building..." : "Build Graph"}
          </button>
        </div>
      </div>

      {/* Build progress */}
      {building && (
        <div className="px-6 py-2 bg-purple-50 border-b border-purple-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-purple-200 rounded-full h-2">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${buildProgress}%` }}
              />
            </div>
            <span className="text-xs text-purple-700 min-w-[60px] text-right">
              {buildProgress}%
            </span>
          </div>
          <p className="text-xs text-purple-600 mt-1">{buildMessage}</p>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Graph panel */}
        <div
          className="transition-all duration-300 border-r border-gray-200 overflow-hidden"
          style={{
            width:
              viewMode === "graph"
                ? "100%"
                : viewMode === "split"
                ? "65%"
                : "0%",
            opacity: viewMode === "list" ? 0 : 1,
          }}
        >
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-10 h-10 border-3 border-gray-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-400">Loading graph...</p>
              </div>
            </div>
          ) : (
            <ForceGraph
              nodes={graphData?.nodes || []}
              edges={graphData?.edges || []}
              onNodeClick={handleNodeClick}
              onBackgroundClick={() => setSelectedNode(null)}
              selectedNodeId={selectedNode?.uuid}
              showEdgeLabels={showEdgeLabels}
            />
          )}
        </div>

        {/* Detail / Filter panel */}
        <div
          className="transition-all duration-300 overflow-y-auto bg-gray-50"
          style={{
            width:
              viewMode === "list"
                ? "100%"
                : viewMode === "split"
                ? "35%"
                : "0%",
            opacity: viewMode === "graph" ? 0 : 1,
          }}
        >
          <div className="p-4 space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Filters
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Sector</label>
                  <select
                    value={sectorFilter}
                    onChange={(e) => setSectorFilter(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">All Sectors</option>
                    {sectors.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Search</label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search entities..."
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>

            {/* Selected node detail */}
            {selectedNode && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedNode.name}
                  </p>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                  >
                    &times;
                  </button>
                </div>

                {/* Entity type badge */}
                <span
                  className="inline-block text-xs text-white px-2 py-0.5 rounded-full mb-3"
                  style={{
                    backgroundColor: getEntityColor(
                      selectedNode.labels?.find((l) => l !== "Entity") || "Entity"
                    ),
                  }}
                >
                  {selectedNode.labels?.find((l) => l !== "Entity") || "Entity"}
                </span>

                {/* Financial data */}
                {selectedNode.financial_data && (
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-gray-900">
                        ${selectedNode.financial_data.current_price?.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-gray-400">Price</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <p
                        className={`text-lg font-bold ${
                          (selectedNode.financial_data.percent_change ?? 0) >= 0
                            ? "text-emerald-600"
                            : "text-red-600"
                        }`}
                      >
                        {(selectedNode.financial_data.percent_change ?? 0) >= 0 ? "+" : ""}
                        {selectedNode.financial_data.percent_change?.toFixed(2)}%
                      </p>
                      <p className="text-[10px] text-gray-400">Change</p>
                    </div>
                  </div>
                )}

                {/* Signal data */}
                {selectedNode.signal_data && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 mb-1">Recent Signals</p>
                    <div className="flex gap-2">
                      <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">
                        {selectedNode.signal_data.positive} Bull
                      </span>
                      <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
                        {selectedNode.signal_data.negative} Bear
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        {selectedNode.signal_data.total} Total
                      </span>
                    </div>
                  </div>
                )}

                {/* Summary */}
                {selectedNode.summary && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 mb-1">Summary</p>
                    <p className="text-xs text-gray-700 leading-relaxed">
                      {selectedNode.summary}
                    </p>
                  </div>
                )}

                {/* Sector */}
                {selectedNode.sector && (
                  <p className="text-xs text-gray-500">
                    Sector: <span className="text-gray-700 font-medium">{selectedNode.sector}</span>
                  </p>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 mt-4">
                  {selectedNode.financial_data && (
                    <button
                      onClick={() =>
                        router.push(`/stocks/${encodeURIComponent(selectedNode.name)}`)
                      }
                      className="flex-1 text-xs bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-500 transition-colors"
                    >
                      View Stock
                    </button>
                  )}
                  <button
                    onClick={() =>
                      router.push(
                        `/scenarios?ticker=${encodeURIComponent(selectedNode.name)}`
                      )
                    }
                    className="flex-1 text-xs bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-500 transition-colors"
                  >
                    Run Scenario
                  </button>
                </div>
              </div>
            )}

            {/* Node list (for list view) */}
            {viewMode === "list" && graphData && (
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="p-3 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    All Entities ({graphData.node_count})
                  </p>
                </div>
                <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
                  {graphData.nodes
                    .filter(
                      (n) =>
                        !searchQuery ||
                        n.name.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((node) => (
                      <button
                        key={node.uuid}
                        onClick={() => handleNodeClick(node)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center gap-3"
                      >
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{
                            backgroundColor: getEntityColor(
                              node.labels?.find((l) => l !== "Entity") || "Entity"
                            ),
                          }}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {node.name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {node.labels?.find((l) => l !== "Entity") || "Entity"}
                            {node.financial_data
                              ? ` · $${node.financial_data.current_price?.toFixed(2)}`
                              : ""}
                          </p>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between px-6 py-2 border-t border-gray-200 bg-white text-xs text-gray-400 shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                graphData && graphData.node_count > 0 ? "bg-emerald-500" : "bg-gray-300"
              }`}
            />
            {graphData && graphData.node_count > 0 ? "Ready" : "Not built"}
          </span>
          {graphData?.built_at && (
            <span>
              Built: {new Date(graphData.built_at).toLocaleString()}
            </span>
          )}
        </div>
        <button
          onClick={fetchGraphData}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}

function getEntityColor(type: string): string {
  const colors: Record<string, string> = {
    Stock: "#10b981",
    Sector: "#3b82f6",
    Company: "#f97316",
    Theme: "#8b5cf6",
    Analyst: "#06b6d4",
    RetailInvestor: "#f59e0b",
    InstitutionalInvestor: "#6366f1",
    Regulator: "#ef4444",
    MediaOutlet: "#ec4899",
    MarketEvent: "#14b8a6",
    Organization: "#64748b",
    Entity: "#9ca3af",
  };
  return colors[type] || colors.Entity;
}
