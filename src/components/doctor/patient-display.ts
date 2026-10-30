import {
  formatClinicTime,
  minutesSince,
} from "@/components/queue/token-display";
import type { StaffTokenView } from "@/features/queue/contracts";

// Time wording for the doctor's patient lists. Only times, never medical
// details: the MVP stores none.

export function waitedMinutes(
  token: Pick<StaffTokenView, "joinedAt">,
  now: number,
): number {
  return minutesSince(token.joinedAt, now);
}

// Minutes since the consultation started, or null before it starts.
export function consultationMinutes(
  token: Pick<StaffTokenView, "serviceStartedAt">,
  now: number,
): number | null {
  return token.serviceStartedAt
    ? minutesSince(token.serviceStartedAt, now)
    : null;
}

// Length of a finished consultation in whole minutes.
export function durationMinutes(
  token: Pick<StaffTokenView, "serviceStartedAt" | "completedAt">,
): number | null {
  if (!token.serviceStartedAt || !token.completedAt) return null;
  return Math.max(
    0,
    Math.round(
      (Date.parse(token.completedAt) - Date.parse(token.serviceStartedAt)) /
        60_000,
    ),
  );
}

// "10:05–10:17" in the clinic's timezone.
export function timeRange(
  token: Pick<StaffTokenView, "serviceStartedAt" | "completedAt">,
  timezone: string,
): string {
  const start = token.serviceStartedAt
    ? formatClinicTime(token.serviceStartedAt, timezone)
    : "";
  const end = token.completedAt
    ? formatClinicTime(token.completedAt, timezone)
    : "";
  return start && end ? `${start}–${end}` : start || end;
}

// Consultations finished per hour, oldest first, for the dashboard wave.
// The shape only matters, so hours count from the first one today.
export function completionsPerHour(
  completed: readonly Pick<StaffTokenView, "completedAt">[],
  now: number,
): number[] {
  const times = completed
    .map((token) => (token.completedAt ? Date.parse(token.completedAt) : NaN))
    .filter((time) => Number.isFinite(time));
  if (times.length === 0) return [];
  const first = Math.min(...times);
  const hours = Math.max(1, Math.floor((now - first) / 3_600_000) + 1);
  const buckets = Array.from({ length: hours }, () => 0);
  for (const time of times) {
    const index = Math.min(hours - 1, Math.floor((time - first) / 3_600_000));
    buckets[index] += 1;
  }
  return buckets;
}
