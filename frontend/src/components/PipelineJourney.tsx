"use client";

import { useEffect, useState } from "react";
import { useStep, Step } from "@/context/StepContext";
import { api, DashboardSummary } from "@/lib/api";
import SearchBar from "./SearchBar";

const steps: {
  id: Step;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 1,
    title: "Sources",
    subtitle: "200+ News Sources",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
  },
  {
    id: 2,
    title: "Filtering & Ontology",
    subtitle: "Intelligent Classification",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
      </svg>
    ),
  },
  {
    id: 3,
    title: "Signal Extraction",
    subtitle: "AI Signals & Themes",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
  {
    id: 4,
    title: "Validated Insights",
    subtitle: "Back-Tested Results",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
];

export default function PipelineJourney() {
  const { activeStep, setActiveStep } = useStep();
  const [stats, setStats] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    api.getDashboard().then(setStats).catch(() => {});
  }, []);

  const getBadge = (step: Step): string => {
    if (!stats) return "";
    switch (step) {
      case 1:
        return `${stats.total_articles} articles`;
      case 2:
        return `${stats.active_themes} themes`;
      case 3:
        return `${stats.total_signals} signals`;
      case 4:
        return `${stats.total_backtests} tested`;
    }
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-72 bg-gray-50 border-r border-gray-200 h-screen shrink-0">
        {/* Logo */}
        <div className="p-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              FI
            </div>
            <div>
              <span className="text-gray-900 font-semibold text-sm">
                Financial Intelligence
              </span>
              <span className="text-gray-400 text-xs block">TSX Pilot</span>
            </div>
          </div>
          <div className="mt-3">
            <SearchBar />
          </div>
        </div>

        {/* Pipeline Steps */}
        <div className="flex-1 p-4 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 px-1">
            Intelligence Pipeline
          </p>
          <div className="space-y-1">
            {steps.map((step, i) => {
              const isActive = activeStep === step.id;
              const isPast = activeStep > step.id;

              return (
                <div key={step.id}>
                  <button
                    onClick={() => setActiveStep(step.id)}
                    className={`w-full text-left rounded-xl p-3 transition-all duration-200 ${
                      isActive
                        ? "bg-emerald-50 border border-emerald-200 shadow-sm"
                        : "hover:bg-gray-100 border border-transparent"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          isActive
                            ? "bg-emerald-600 text-white"
                            : isPast
                            ? "bg-emerald-100 text-emerald-600"
                            : "bg-gray-200 text-gray-500"
                        }`}
                      >
                        {step.icon}
                      </div>
                      <div className="min-w-0">
                        <p
                          className={`text-sm font-medium ${
                            isActive
                              ? "text-emerald-700"
                              : "text-gray-700"
                          }`}
                        >
                          {step.title}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {step.subtitle}
                        </p>
                        {stats && (
                          <span
                            className={`inline-block text-xs mt-1 px-2 py-0.5 rounded-full ${
                              isActive
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {getBadge(step.id)}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Connector line */}
                  {i < steps.length - 1 && (
                    <div className="flex justify-start ml-[1.35rem] py-1">
                      <div
                        className={`w-0.5 h-4 rounded-full ${
                          activeStep > step.id
                            ? "bg-emerald-400"
                            : "bg-gray-200"
                        }`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <p className="text-xs text-gray-400 text-center">
            Financial Intelligence Platform v1.0
          </p>
        </div>
      </aside>

      {/* Mobile bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 lg:hidden z-40">
        <div className="flex">
          {steps.map((step) => {
            const isActive = activeStep === step.id;
            return (
              <button
                key={step.id}
                onClick={() => setActiveStep(step.id)}
                className={`flex-1 flex flex-col items-center py-2 px-1 transition-colors ${
                  isActive
                    ? "text-emerald-600"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <div className={`${isActive ? "text-emerald-600" : "text-gray-400"}`}>
                  {step.icon}
                </div>
                <span className="text-[10px] mt-0.5 font-medium truncate max-w-full">
                  {step.id === 2 ? "Ontology" : step.id === 4 ? "Insights" : step.title}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
