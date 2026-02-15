"use client";

import { useRouter } from "next/navigation";
import { useStep, Step } from "@/context/StepContext";

const steps: { id: Step; label: string }[] = [
  { id: 1, label: "Sources" },
  { id: 2, label: "Ontology" },
  { id: 3, label: "Signals" },
  { id: 4, label: "Insights" },
];

interface DetailNavProps {
  backLabel: string;
  backHref: string;
}

export default function DetailNav({ backLabel, backHref }: DetailNavProps) {
  const router = useRouter();
  const { setActiveStep } = useStep();

  const navigateToStep = (step: Step) => {
    setActiveStep(step);
    router.push("/");
  };

  return (
    <div className="flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-1">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center">
            <button
              onClick={() => navigateToStep(step.id)}
              className="text-xs px-2.5 py-1 rounded-full font-medium transition-colors bg-gray-100 text-gray-600 hover:bg-emerald-100 hover:text-emerald-700"
            >
              {step.label}
            </button>
            {i < steps.length - 1 && (
              <span className="text-gray-300 mx-0.5 text-xs">&rsaquo;</span>
            )}
          </div>
        ))}
      </div>
      <button
        onClick={() => router.push(backHref)}
        className="text-sm text-gray-500 hover:text-emerald-600 transition-colors"
      >
        &larr; {backLabel}
      </button>
    </div>
  );
}
