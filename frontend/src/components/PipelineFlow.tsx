"use client";

import { PipelineStats } from "@/lib/api";

interface PipelineFlowProps {
  stats: PipelineStats;
  totalArticles: number;
  totalSignals: number;
  totalBacktests: number;
}

interface StageProps {
  label: string;
  count: number;
  todayCount: number;
  color: string;
}

function Stage({ label, count, todayCount, color }: StageProps) {
  return (
    <div className="flex-1 text-center">
      <div
        className={`rounded-lg border px-3 py-4 ${color}`}
      >
        <div className="text-2xl font-bold text-slate-100">{count.toLocaleString()}</div>
        <div className="text-xs text-slate-400 mt-1">{label}</div>
        {todayCount > 0 && (
          <div className="text-xs text-emerald-400 mt-1">+{todayCount} today</div>
        )}
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex items-center justify-center px-1">
      <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );
}

export default function PipelineFlow({
  stats,
  totalArticles,
  totalSignals,
  totalBacktests,
}: PipelineFlowProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Pipeline Flow</h2>
        {stats.last_ingestion_time && (
          <span className="text-xs text-slate-500">
            Last ingestion:{" "}
            {new Date(stats.last_ingestion_time).toLocaleString()}
          </span>
        )}
      </div>
      <div className="flex items-center">
        <Stage
          label="Sources"
          count={stats.total_sources}
          todayCount={0}
          color="bg-blue-500/10 border-blue-500/20"
        />
        <Arrow />
        <Stage
          label="Articles"
          count={totalArticles}
          todayCount={stats.articles_ingested_today}
          color="bg-cyan-500/10 border-cyan-500/20"
        />
        <Arrow />
        <Stage
          label="Signals"
          count={totalSignals}
          todayCount={stats.signals_generated_today}
          color="bg-emerald-500/10 border-emerald-500/20"
        />
        <Arrow />
        <Stage
          label="Backtested"
          count={totalBacktests}
          todayCount={stats.backtests_run_today}
          color="bg-purple-500/10 border-purple-500/20"
        />
      </div>
      <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
        <span>{stats.sentiment_posts_today} sentiment posts today</span>
        <span>{stats.articles_processed_today} articles processed today</span>
      </div>
    </div>
  );
}
