"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStep } from "@/context/StepContext";

export default function NewsRedirect() {
  const router = useRouter();
  const { setActiveStep } = useStep();

  useEffect(() => {
    setActiveStep(2);
    router.replace("/");
  }, []);

  return null;
}
