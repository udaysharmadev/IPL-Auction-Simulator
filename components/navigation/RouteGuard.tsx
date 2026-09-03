"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { canEnter, requiredPath } from "@/domain/onboarding";
import { mirrorOnboardingCheckpoint, useOnboardingStore } from "@/stores/onboardingStore";

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const progress = useOnboardingStore();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const persistence = useOnboardingStore.persist;
    if (persistence.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return persistence.onFinishHydration(() => {
      mirrorOnboardingCheckpoint(useOnboardingStore.getState());
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated || canEnter(pathname, progress)) return;
    router.replace(requiredPath(progress));
  }, [hydrated, pathname, progress, router]);

  if (!hydrated || !canEnter(pathname, progress)) {
    return <div className="boot-screen"><div className="boot-mark">27</div><span>CHECKING FRANCHISE CHECKPOINT</span></div>;
  }
  return children;
}
