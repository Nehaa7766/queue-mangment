import type { WaitEstimate } from "@/features/queue/eta";
import { messages } from "./messages";

// Always a range, never a single exact time (docs/PLAN.md §9 rule 13).
export function formatEta(estimate: WaitEstimate): string {
  const { minMinutes, maxMinutes } = estimate;
  if (minMinutes <= 0) {
    return `Up to ${maxMinutes} min`;
  }
  return `${minMinutes}–${maxMinutes} min`;
}

export function formatUpdatedAgo(updatedAt: string, now: number): string {
  const minutes = Math.floor((now - Date.parse(updatedAt)) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 1) {
    return messages.token.updatedJustNow;
  }
  return messages.token.updatedMinutesAgo(minutes);
}
