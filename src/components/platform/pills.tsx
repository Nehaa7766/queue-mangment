import type { SupportTicketStatus, UserStatus } from "@/generated/prisma/enums";
import {
  LIFECYCLE_LABELS,
  type ClinicLifecycle,
} from "@/features/platform/lifecycle";
import { SUPPORT_STATUS_LABELS } from "@/features/platform/schemas";
import { cn } from "@/lib/utils";

// Status pills always pair the colour with a text label (docs/GUI_RULES.md §8).
const PILL =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap";

const WAIT = "bg-status-wait text-status-wait-foreground";
const DONE = "bg-status-done text-status-done-foreground";
const MISS = "bg-status-miss text-status-miss-foreground";
const OFF = "bg-status-off text-status-off-foreground";
const BRAND = "bg-brand-tint text-brand";

const LIFECYCLE_STYLES: Record<ClinicLifecycle, string> = {
  ACTIVE: DONE,
  PENDING: WAIT,
  SUSPENDED: MISS,
};

const TICKET_STYLES: Record<SupportTicketStatus, string> = {
  OPEN: WAIT,
  IN_PROGRESS: BRAND,
  RESOLVED: DONE,
};

export function LifecyclePill({ lifecycle }: { lifecycle: ClinicLifecycle }) {
  return (
    <span className={cn(PILL, LIFECYCLE_STYLES[lifecycle])}>
      {LIFECYCLE_LABELS[lifecycle]}
    </span>
  );
}

export function TicketPill({ status }: { status: SupportTicketStatus }) {
  return (
    <span className={cn(PILL, TICKET_STYLES[status])}>
      {SUPPORT_STATUS_LABELS[status]}
    </span>
  );
}

export function UserStatusPill({ status }: { status: UserStatus }) {
  return (
    <span className={cn(PILL, status === "ACTIVE" ? DONE : OFF)}>
      {status === "ACTIVE" ? "Active" : "Deactivated"}
    </span>
  );
}

// Dates shown to platform admins, e.g. "30 Oct 2026".
export function formatDate(iso: string | null, timeZone = "UTC"): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}
