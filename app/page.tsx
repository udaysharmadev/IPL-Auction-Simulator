"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { requiredPath } from "@/domain/onboarding";
import { bootstrapOnboarding, useOnboardingStore } from "@/stores/onboardingStore";

/** Boot/resume endpoint. Middleware handles SSR redirects; this is the client fallback. */
export default function HomePage() {
  const router = useRouter();
  const progress = useOnboardingStore();
  const destination = requiredPath(progress);

  useEffect(() => {
    bootstrapOnboarding();
    router.replace(destination);
  }, [destination, router]);

  return <div className="boot-screen"><div className="boot-mark">27</div><span>INITIALIZING FRANCHISE HQ</span></div>;
}
