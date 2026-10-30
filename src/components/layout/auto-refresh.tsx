"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Re-renders the current Server Component page every `seconds` while the tab
// is visible, so dashboards stay current without a reload.
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => window.clearInterval(id);
  }, [router, seconds]);
  return null;
}
