"use client";

import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import type { GraphNode, GraphEdge } from "@/lib/api";

const ENTITY_COLORS: Record<string, string> = {
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

interface ForceGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (node: GraphNode) => void;
  onEdgeClick?: (edge: GraphEdge) => void;
  onBackgroundClick?: () => void;
  selectedNodeId?: string | null;
  showEdgeLabels?: boolean;
  className?: string;
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: string;
  rawData: GraphNode;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  name: string;
  curvature: number;
  isSelfLoop: boolean;
  pairTotal: number;
  rawData: GraphEdge;
}

function getNodeColor(type: string): string {
  return ENTITY_COLORS[type] || ENTITY_COLORS.Entity;
}

export default function ForceGraph({
  nodes: rawNodes,
  edges: rawEdges,
  onNodeClick,
  onEdgeClick,
  onBackgroundClick,
  selectedNodeId,
  showEdgeLabels = true,
  className = "",
}: ForceGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);

  const render = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return;
    if (rawNodes.length === 0) return;

    // Stop previous simulation
    simulationRef.current?.stop();

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);

    svg.selectAll("*").remove();

    // Build node map
    const nodeMap: Record<string, GraphNode> = {};
    rawNodes.forEach((n) => (nodeMap[n.uuid] = n));

    const nodes: SimNode[] = rawNodes.map((n) => ({
      id: n.uuid,
      name: n.name || "Unnamed",
      type: n.labels?.find((l) => l !== "Entity") || "Entity",
      rawData: n,
    }));

    const nodeIds = new Set(nodes.map((n) => n.id));

    // Build edges with curvature for parallel edges
    const edgePairCount: Record<string, number> = {};
    const validEdges = rawEdges.filter(
      (e) => nodeIds.has(e.source_node_uuid) && nodeIds.has(e.target_node_uuid)
    );

    validEdges.forEach((e) => {
      if (e.source_node_uuid !== e.target_node_uuid) {
        const key = [e.source_node_uuid, e.target_node_uuid].sort().join("_");
        edgePairCount[key] = (edgePairCount[key] || 0) + 1;
      }
    });

    const edgePairIndex: Record<string, number> = {};
    const processedSelfLoops = new Set<string>();
    const links: SimLink[] = [];

    validEdges.forEach((e) => {
      if (e.source_node_uuid === e.target_node_uuid) {
        if (processedSelfLoops.has(e.source_node_uuid)) return;
        processedSelfLoops.add(e.source_node_uuid);
        links.push({
          source: e.source_node_uuid,
          target: e.target_node_uuid,
          name: "Self",
          curvature: 0,
          isSelfLoop: true,
          pairTotal: 1,
          rawData: e,
        });
        return;
      }

      const key = [e.source_node_uuid, e.target_node_uuid].sort().join("_");
      const total = edgePairCount[key];
      const idx = edgePairIndex[key] || 0;
      edgePairIndex[key] = idx + 1;

      let curvature = 0;
      if (total > 1) {
        const range = Math.min(1.2, 0.6 + total * 0.15);
        curvature = (idx / (total - 1) - 0.5) * range * 2;
        if (e.source_node_uuid > e.target_node_uuid) curvature = -curvature;
      }

      links.push({
        source: e.source_node_uuid,
        target: e.target_node_uuid,
        name: e.name || e.fact_type || "RELATED",
        curvature,
        isSelfLoop: false,
        pairTotal: total,
        rawData: e,
      });
    });

    // Simulation
    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance((d) => 150 + ((d.pairTotal || 1) - 1) * 50)
      )
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide(50))
      .force("x", d3.forceX(width / 2).strength(0.04))
      .force("y", d3.forceY(height / 2).strength(0.04));

    simulationRef.current = simulation;

    const g = svg.append("g");

    // Zoom
    svg.call(
      d3
        .zoom<SVGSVGElement, unknown>()
        .extent([
          [0, 0],
          [width, height],
        ])
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => g.attr("transform", event.transform))
    );

    // Helper functions
    const getLinkPath = (d: SimLink) => {
      const s = d.source as SimNode;
      const t = d.target as SimNode;
      const sx = s.x!, sy = s.y!, tx = t.x!, ty = t.y!;

      if (d.isSelfLoop) {
        const r = 30;
        return `M${sx + 8},${sy - 4} A${r},${r} 0 1,1 ${sx + 8},${sy + 4}`;
      }
      if (d.curvature === 0) return `M${sx},${sy} L${tx},${ty}`;

      const dx = tx - sx, dy = ty - sy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ratio = 0.25 + (d.pairTotal || 1) * 0.05;
      const base = Math.max(35, dist * ratio);
      const ox = (-dy / dist) * d.curvature * base;
      const oy = (dx / dist) * d.curvature * base;
      const cx = (sx + tx) / 2 + ox;
      const cy = (sy + ty) / 2 + oy;
      return `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`;
    };

    const getLinkMid = (d: SimLink) => {
      const s = d.source as SimNode;
      const t = d.target as SimNode;
      const sx = s.x!, sy = s.y!, tx = t.x!, ty = t.y!;

      if (d.isSelfLoop) return { x: sx + 70, y: sy };
      if (d.curvature === 0) return { x: (sx + tx) / 2, y: (sy + ty) / 2 };

      const dx = tx - sx, dy = ty - sy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ratio = 0.25 + (d.pairTotal || 1) * 0.05;
      const base = Math.max(35, dist * ratio);
      const ox = (-dy / dist) * d.curvature * base;
      const oy = (dx / dist) * d.curvature * base;
      const cx = (sx + tx) / 2 + ox;
      const cy = (sy + ty) / 2 + oy;
      return { x: 0.25 * sx + 0.5 * cx + 0.25 * tx, y: 0.25 * sy + 0.5 * cy + 0.25 * ty };
    };

    // Links
    const linkGroup = g.append("g").attr("class", "links");

    const link = linkGroup
      .selectAll<SVGPathElement, SimLink>("path")
      .data(links)
      .enter()
      .append("path")
      .attr("stroke", "#C0C0C0")
      .attr("stroke-width", 1.5)
      .attr("fill", "none")
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        event.stopPropagation();
        onEdgeClick?.(d.rawData);
      });

    // Edge label backgrounds
    const linkLabelBg = linkGroup
      .selectAll<SVGRectElement, SimLink>("rect")
      .data(links)
      .enter()
      .append("rect")
      .attr("fill", "rgba(255,255,255,0.95)")
      .attr("rx", 3)
      .attr("ry", 3)
      .style("display", showEdgeLabels ? "block" : "none")
      .style("pointer-events", "none");

    // Edge labels
    const linkLabels = linkGroup
      .selectAll<SVGTextElement, SimLink>("text")
      .data(links)
      .enter()
      .append("text")
      .text((d) => d.name)
      .attr("font-size", "9px")
      .attr("fill", "#666")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .style("font-family", "system-ui, sans-serif")
      .style("pointer-events", "none")
      .style("display", showEdgeLabels ? "block" : "none");

    // Nodes
    const nodeGroup = g.append("g").attr("class", "nodes");

    const node = nodeGroup
      .selectAll<SVGCircleElement, SimNode>("circle")
      .data(nodes)
      .enter()
      .append("circle")
      .attr("r", 10)
      .attr("fill", (d) => getNodeColor(d.type))
      .attr("stroke", "#fff")
      .attr("stroke-width", 2.5)
      .style("cursor", "pointer")
      .call(
        d3
          .drag<SVGCircleElement, SimNode>()
          .on("start", (event, d) => {
            d.fx = d.x;
            d.fy = d.y;
            (d as any)._startX = event.x;
            (d as any)._startY = event.y;
            (d as any)._dragging = false;
          })
          .on("drag", (event, d) => {
            const dx = event.x - (d as any)._startX;
            const dy = event.y - (d as any)._startY;
            if (!(d as any)._dragging && Math.sqrt(dx * dx + dy * dy) > 3) {
              (d as any)._dragging = true;
              simulation.alphaTarget(0.3).restart();
            }
            if ((d as any)._dragging) {
              d.fx = event.x;
              d.fy = event.y;
            }
          })
          .on("end", (_event, d) => {
            if ((d as any)._dragging) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      )
      .on("click", (event, d) => {
        event.stopPropagation();
        node.attr("stroke", "#fff").attr("stroke-width", 2.5);
        d3.select(event.currentTarget as SVGCircleElement)
          .attr("stroke", "#E91E63")
          .attr("stroke-width", 4);
        link
          .attr("stroke", (l: SimLink) =>
            (l.source as SimNode).id === d.id || (l.target as SimNode).id === d.id
              ? "#E91E63"
              : "#C0C0C0"
          )
          .attr("stroke-width", (l: SimLink) =>
            (l.source as SimNode).id === d.id || (l.target as SimNode).id === d.id
              ? 2.5
              : 1.5
          );
        onNodeClick?.(d.rawData);
      })
      .on("mouseenter", (event) => {
        d3.select(event.currentTarget as SVGCircleElement)
          .attr("stroke", "#333")
          .attr("stroke-width", 3);
      })
      .on("mouseleave", (event, d) => {
        if (selectedNodeId !== d.id) {
          d3.select(event.currentTarget as SVGCircleElement)
            .attr("stroke", "#fff")
            .attr("stroke-width", 2.5);
        }
      });

    // Node labels
    nodeGroup
      .selectAll<SVGTextElement, SimNode>("text")
      .data(nodes)
      .enter()
      .append("text")
      .text((d) => (d.name.length > 12 ? d.name.substring(0, 12) + "…" : d.name))
      .attr("font-size", "11px")
      .attr("fill", "#333")
      .attr("font-weight", "500")
      .attr("dx", 14)
      .attr("dy", 4)
      .style("pointer-events", "none")
      .style("font-family", "system-ui, sans-serif");

    // Tick
    simulation.on("tick", () => {
      link.attr("d", (d) => getLinkPath(d));

      linkLabels.each(function (d) {
        const mid = getLinkMid(d);
        d3.select(this).attr("x", mid.x).attr("y", mid.y);
      });

      linkLabelBg.each(function (d, i) {
        const mid = getLinkMid(d);
        const textEl = linkLabels.nodes()[i];
        if (textEl) {
          const bbox = textEl.getBBox();
          d3.select(this)
            .attr("x", mid.x - bbox.width / 2 - 4)
            .attr("y", mid.y - bbox.height / 2 - 2)
            .attr("width", bbox.width + 8)
            .attr("height", bbox.height + 4);
        }
      });

      node.attr("cx", (d) => d.x!).attr("cy", (d) => d.y!);

      nodeGroup
        .selectAll<SVGTextElement, SimNode>("text")
        .attr("x", (d) => d.x!)
        .attr("y", (d) => d.y!);
    });

    // Background click
    svg.on("click", () => {
      node.attr("stroke", "#fff").attr("stroke-width", 2.5);
      link.attr("stroke", "#C0C0C0").attr("stroke-width", 1.5);
      onBackgroundClick?.();
    });
  }, [rawNodes, rawEdges, onNodeClick, onEdgeClick, onBackgroundClick, selectedNodeId, showEdgeLabels]);

  useEffect(() => {
    render();
    const handleResize = () => render();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      simulationRef.current?.stop();
    };
  }, [render]);

  // Get entity types for legend
  const entityTypes = rawNodes.reduce<Record<string, number>>((acc, n) => {
    const type = n.labels?.find((l) => l !== "Entity") || "Entity";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div ref={containerRef} className={`relative w-full h-full ${className}`}>
      {/* Graph SVG */}
      <svg
        ref={svgRef}
        className="w-full h-full block"
        style={{
          backgroundColor: "#FAFAFA",
          backgroundImage: "radial-gradient(#D0D0D0 1.5px, transparent 1.5px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Legend */}
      {rawNodes.length > 0 && (
        <div className="absolute bottom-6 left-6 bg-white/95 p-3 rounded-lg border border-gray-200 shadow-sm z-10">
          <p className="text-[11px] font-semibold text-purple-600 uppercase tracking-wide mb-2">
            Entity Types
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 max-w-[320px]">
            {Object.entries(entityTypes).map(([type, count]) => (
              <div key={type} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: getNodeColor(type) }}
                />
                <span>
                  {type} ({count})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {rawNodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <div className="text-5xl mb-4 opacity-20">&#10070;</div>
            <p className="text-sm">No graph data yet</p>
            <p className="text-xs mt-1">Build a knowledge graph to see relationships</p>
          </div>
        </div>
      )}
    </div>
  );
}
