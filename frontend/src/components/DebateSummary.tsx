"use client";

import type { ConsensusResult } from "@/lib/api";

const PERSONA_ICONS: Record<string, string> = {
  "Value Investor": "📈",
  "Growth Trader": "📊",
  "Macro Analyst": "🏦",
  "Risk Manager": "⚠️",
  "Retail Investor": "👤",
};

interface DebateSummaryProps {
  consensus: ConsensusResult;
}

export default function DebateSummary({ consensus }: DebateSummaryProps) {
  const bullArgs = consensus.key_arguments_bull || [];
  const bearArgs = consensus.key_arguments_bear || [];

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="flex items-center gap-3 text-sm">
        <span className="bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full text-xs font-medium">
          {consensus.bull_count} Bullish
        </span>
        <span className="bg-red-50 text-red-600 px-2.5 py-1 rounded-full text-xs font-medium">
          {consensus.bear_count} Bearish
        </span>
        <span className="bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full text-xs font-medium">
          {consensus.neutral_count} Neutral
        </span>
        {consensus.agreement_ratio != null && (
          <span className="text-xs text-gray-400 ml-auto">
            Agreement: {(consensus.agreement_ratio * 100).toFixed(0)}%
          </span>
        )}
      </div>

      {/* Bull case */}
      {bullArgs.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">
            Bull Case ({bullArgs.length})
          </p>
          <div className="space-y-2">
            {bullArgs.map((arg, i) => {
              // Try to extract persona name from argument
              const persona = Object.keys(PERSONA_ICONS).find((p) =>
                arg.toLowerCase().includes(p.toLowerCase())
              );
              return (
                <div
                  key={i}
                  className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-sm text-emerald-800"
                >
                  <span className="mr-1.5">
                    {persona ? PERSONA_ICONS[persona] : "📈"}
                  </span>
                  {arg}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bear case */}
      {bearArgs.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-2">
            Bear Case ({bearArgs.length})
          </p>
          <div className="space-y-2">
            {bearArgs.map((arg, i) => {
              const persona = Object.keys(PERSONA_ICONS).find((p) =>
                arg.toLowerCase().includes(p.toLowerCase())
              );
              return (
                <div
                  key={i}
                  className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-800"
                >
                  <span className="mr-1.5">
                    {persona ? PERSONA_ICONS[persona] : "⚠️"}
                  </span>
                  {arg}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Debate summary */}
      {consensus.debate_summary && (
        <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Summary
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">
            {consensus.debate_summary}
          </p>
        </div>
      )}
    </div>
  );
}
