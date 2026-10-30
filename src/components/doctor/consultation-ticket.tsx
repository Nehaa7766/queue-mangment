import type { ReactNode } from "react";
import {
  displayName,
  formatClinicTime,
  minutesSince,
} from "@/components/queue/token-display";
import type { StaffTokenView } from "@/features/queue/contracts";
import { cn } from "@/lib/utils";

// The doctor's current consultation as a ticket stub (docs/GUI_RULES.md §5).
// Shows only name, token and service: the MVP stores no medical data.
export function ConsultationTicket({
  token,
  now,
  timezone,
  actions,
  className,
}: {
  token: Pick<
    StaffTokenView,
    "tokenLabel" | "patientName" | "serviceName" | "serviceStartedAt"
  >;
  now: number;
  timezone: string;
  actions?: ReactNode;
  className?: string;
}) {
  const minutes = token.serviceStartedAt
    ? minutesSince(token.serviceStartedAt, now)
    : null;
  return (
    <section
      aria-label="Current consultation"
      className={cn(
        "flex flex-col overflow-hidden rounded-card border border-border bg-card sm:flex-row",
        className,
      )}
    >
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {`In consultation with ${token.tokenLabel}, ${displayName(token.patientName)}`}
      </p>
      <div className="relative flex shrink-0 flex-col gap-0.5 border-b-2 border-dashed border-background bg-slate px-5 py-4 text-white sm:w-40 sm:border-r-2 sm:border-b-0">
        <span className="text-[11px] font-semibold tracking-[0.08em] text-slate-muted uppercase">
          In consultation
        </span>
        <span className="font-display text-[44px] leading-tight font-extrabold tabular-nums sm:text-[52px]">
          {token.tokenLabel}
        </span>
        {token.serviceStartedAt && (
          <span className="text-sm text-sand tabular-nums">
            Started {formatClinicTime(token.serviceStartedAt, timezone)}
          </span>
        )}
        <span
          aria-hidden
          className="absolute -bottom-[9px] -left-[9px] size-[18px] rounded-full bg-background sm:top-[-9px] sm:right-[-9px] sm:bottom-auto sm:left-auto"
        />
        <span
          aria-hidden
          className="absolute -right-[9px] -bottom-[9px] size-[18px] rounded-full bg-background"
        />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">
              {displayName(token.patientName)}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {token.serviceName}
            </p>
          </div>
          {minutes !== null && (
            <span className="shrink-0 rounded-full bg-slate px-3 py-1 text-xs font-semibold text-white tabular-nums">
              {minutes} min
            </span>
          )}
        </div>
        {actions}
      </div>
    </section>
  );
}
