"use client";

import { useEffect, useState } from "react";

// Current time that re-renders every `intervalMs`, for countdowns and
// "waited" minutes. Starts from `initialNow` (a time the server also used)
// so the server render and hydration show the same values.
export function useNow(initialNow: number, intervalMs = 1000): number {
  const [now, setNow] = useState(initialNow);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
