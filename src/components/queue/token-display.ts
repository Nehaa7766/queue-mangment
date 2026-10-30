import type { QueueStatus } from "@/features/queue/queue-rules";
import type { TokenStatus } from "@/features/queue/token-status";

// Status label and style pairs (docs/GUI_RULES.md §2). Color is never the
// only signal: every style comes with a text label.

const WAIT = "bg-status-wait text-status-wait-foreground";
const DONE = "bg-status-done text-status-done-foreground";
const MISS = "bg-status-miss text-status-miss-foreground";
const OFF = "bg-status-off text-status-off-foreground";

export const TOKEN_STATUS_DISPLAY: Record<
  TokenStatus,
  { label: string; className: string }
> = {
  WAITING: { label: "Waiting", className: WAIT },
  CALLED: { label: "Called", className: WAIT },
  IN_SERVICE: { label: "In consultation", className: "bg-brand text-white" },
  COMPLETED: { label: "Done", className: DONE },
  SKIPPED: { label: "No-show", className: MISS },
  CANCELLED: { label: "Cancelled", className: OFF },
};

export const QUEUE_STATUS_DISPLAY: Record<
  QueueStatus,
  { label: string; className: string }
> = {
  OPEN: { label: "Queue open", className: DONE },
  PAUSED: { label: "Queue paused", className: OFF },
  CLOSED: { label: "Queue closed", className: OFF },
};

export function minutesSince(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
}

// "1:42" for elapsed or remaining seconds; "2h 05m" from an hour up, where
// "125:00" would be hard to read.
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds >= 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
  }
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

// "09:05" in the clinic's timezone.
export function formatClinicTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

// "Thu, 29 Oct" in the clinic's timezone.
export function formatClinicDay(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

export function displayName(patientName: string | null): string {
  return patientName ?? "Patient";
}
