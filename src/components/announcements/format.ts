import type { PillTone } from "@/components/admin/admin-ui";
import { formatClinicTime } from "@/components/queue/token-display";
import {
  BROADCAST_SKIP_REASONS,
  type BroadcastDetail,
  type BroadcastRecipientStatus,
  type BroadcastSkipReason,
  type BroadcastSummary,
} from "@/features/messaging/contracts";

// Labels and numbers shared by the announcement list, composer and progress
// screens. Every status has a text label; colour is never the only signal.

const NUMBER = new Intl.NumberFormat("en-GB");

export function formatCount(value: number): string {
  return NUMBER.format(value);
}

export function patientsLabel(count: number): string {
  return `${formatCount(count)} ${count === 1 ? "patient" : "patients"}`;
}

export function servicesLabel(serviceNames: string[]): string {
  return serviceNames.length === 0 ? "All services" : serviceNames.join(", ");
}

// Null when the sender's account is gone.
export function senderLabel(name: string | null): string {
  return name ?? "a staff member";
}

function clinicDay(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// "Thu, 29 Oct", built from parts because whole-string formats differ
// between ICU versions.
function shortDay(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("weekday")}, ${part("day")} ${part("month")}`;
}

// "Today, 10:42" or "Thu, 29 Oct, 10:42" in the clinic's timezone.
export function formatWhen(iso: string, timeZone: string, now: number) {
  const date = new Date(iso);
  const time = formatClinicTime(iso, timeZone);
  return clinicDay(date, timeZone) === clinicDay(new Date(now), timeZone)
    ? `Today, ${time}`
    : `${shortDay(date, timeZone)}, ${time}`;
}

// One line for previews: newlines and runs of spaces become single spaces.
export function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

type Counts = BroadcastSummary["counts"];

// Recipients the processor has finished with (sent, skipped or failed).
export function handledCount(counts: Counts): number {
  return Math.max(0, counts.total - counts.pending);
}

export function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export const BROADCAST_STATUS_DISPLAY: Record<
  BroadcastSummary["status"],
  { label: string; tone: PillTone }
> = {
  SENDING: { label: "Sending", tone: "wait" },
  DONE: { label: "Finished", tone: "done" },
};

// SENT means stored in the patient's chat, whether or not they are online.
export const RECIPIENT_STATUS_DISPLAY: Record<
  BroadcastRecipientStatus,
  { label: string; tone: PillTone }
> = {
  PENDING: { label: "Pending", tone: "wait" },
  SENT: { label: "Sent", tone: "done" },
  SKIPPED: { label: "Skipped", tone: "off" },
  FAILED: { label: "Failed", tone: "miss" },
};

export const SKIP_REASON_ORDER = Object.keys(
  BROADCAST_SKIP_REASONS,
) as BroadcastSkipReason[];

// How many recipients were skipped for each reason, in the contract's order,
// leaving out reasons nobody was skipped for.
export function skipReasonCounts(
  recipients: BroadcastDetail["recipients"],
): { reason: BroadcastSkipReason; label: string; count: number }[] {
  const counts = new Map<BroadcastSkipReason, number>();
  for (const recipient of recipients) {
    if (recipient.status === "SKIPPED" && recipient.skipReason) {
      counts.set(
        recipient.skipReason,
        (counts.get(recipient.skipReason) ?? 0) + 1,
      );
    }
  }
  return SKIP_REASON_ORDER.filter((reason) => counts.has(reason)).map(
    (reason) => ({
      reason,
      label: BROADCAST_SKIP_REASONS[reason],
      count: counts.get(reason) ?? 0,
    }),
  );
}

// "Sending. 8 of 12 handled: 7 sent, 1 skipped, 0 failed." for the live
// region, so screen readers hear one sentence instead of six numbers.
export function progressSentence(summary: BroadcastSummary): string {
  const { counts } = summary;
  const handled = handledCount(counts);
  const lead =
    summary.status === "SENDING"
      ? `Sending. ${formatCount(handled)} of ${patientsLabel(counts.total)} handled`
      : `Finished. All ${patientsLabel(counts.total)} handled`;
  return `${lead}: ${formatCount(counts.sent)} sent, ${formatCount(counts.skipped)} skipped, ${formatCount(counts.failed)} failed.`;
}
