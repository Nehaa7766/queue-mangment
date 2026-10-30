import type { WaitEstimate } from "@/features/queue/eta";
import { messages } from "./messages";

// Long waits read better in hours: "5.5–9 hours" rather than "330–550 min".
const HOURS_FROM_MINUTES = 90;

// Rounded to the nearest half hour.
function hours(minutes: number): string {
  const value = Math.round(minutes / 30) / 2;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

// Always a range, never a single exact time (docs/PLAN.md §9 rule 13).
export function formatEta(estimate: WaitEstimate): string {
  const { minMinutes, maxMinutes } = estimate;
  if (maxMinutes >= HOURS_FROM_MINUTES) {
    return minMinutes <= 0
      ? `Up to ${hours(maxMinutes)} hours`
      : `${hours(minMinutes)}–${hours(maxMinutes)} hours`;
  }
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
