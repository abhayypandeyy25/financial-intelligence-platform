"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export type Step = 1 | 2 | 3 | 4;

interface StepContextType {
  activeStep: Step;
  setActiveStep: (step: Step) => void;
}

const StepContext = createContext<StepContextType>({
  activeStep: 1,
  setActiveStep: () => {},
});

export function StepProvider({ children }: { children: ReactNode }) {
  const [activeStep, setActiveStep] = useState<Step>(1);
  return (
    <StepContext.Provider value={{ activeStep, setActiveStep }}>
      {children}
    </StepContext.Provider>
  );
}

export const useStep = () => useContext(StepContext);
