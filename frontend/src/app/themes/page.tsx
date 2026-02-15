"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStep } from "@/context/StepContext";

export default function ThemesRedirect() {
  const router = useRouter();
  const { setActiveStep } = useStep();

  useEffect(() => {
    setActiveStep(3);
    router.replace("/");
  }, []);

  return null;
}
