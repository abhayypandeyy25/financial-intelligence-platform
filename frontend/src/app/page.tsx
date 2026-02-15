"use client";

import { useStep } from "@/context/StepContext";
import SourcesPanel from "@/panels/SourcesPanel";
import OntologyPanel from "@/panels/OntologyPanel";
import SignalsPanel from "@/panels/SignalsPanel";
import InsightsPanel from "@/panels/InsightsPanel";

export default function HomePage() {
  const { activeStep } = useStep();

  return (
    <>
      {activeStep === 1 && <SourcesPanel />}
      {activeStep === 2 && <OntologyPanel />}
      {activeStep === 3 && <SignalsPanel />}
      {activeStep === 4 && <InsightsPanel />}
    </>
  );
}
