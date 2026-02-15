"use client";

import { StepProvider } from "@/context/StepContext";
import PipelineJourney from "./PipelineJourney";
import FloatingChat from "./FloatingChat";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <StepProvider>
      <div className="flex h-screen bg-white">
        <PipelineJourney />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <FloatingChat />
    </StepProvider>
  );
}
