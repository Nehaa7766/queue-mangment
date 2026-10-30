import type { ReactNode } from "react";
import {
  displayName,
  formatClinicTime,
  minutesSince,
} from "@/components/queue/token-display";
import type { StaffTokenView } from "@/features/queue/contracts";
import { cn } from "@/lib/utils";

// The doctor's current consultation: a large white card with a brand-coloured
// token stub (docs/GUI_RULES.md §5). Shows only name, token, service and
// times: the MVP stores no medical data.
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
        "flex flex-col overflow-hidden rounded-card border border-border bg-card shadow-card sm:flex-row",
        className,
      )}
    >
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {`In consultation with ${token.tokenLabel}, ${displayName(token.patientName)}`}
      </p>
      <div className="relative flex shrink-0 flex-col justify-center gap-1 border-b-2 border-dashed border-background bg-brand px-6 py-6 text-white sm:w-52 sm:border-r-2 sm:border-b-0">
        <span className="text-[11px] font-semibold tracking-[0.08em] text-brand-muted uppercase">
          In consultation
        </span>
        <span className="font-display text-[48px] leading-tight font-extrabold tabular-nums sm:text-[56px]">
          {token.tokenLabel}
        </span>
        {token.serviceStartedAt && (
          <span className="text-sm text-brand-muted tabular-nums">
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
      <div className="flex flex-1 flex-col justify-between gap-5 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
              Patient
            </p>
            <p className="truncate text-xl font-semibold">
              {displayName(token.patientName)}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {token.serviceName}
            </p>
          </div>
          {minutes !== null && (
            <span className="shrink-0 rounded-full bg-brand-tint px-3 py-1 text-xs font-semibold text-brand tabular-nums">
              {minutes} min
            </span>
          )}
        </div>
        {actions}
      </div>
    </section>
  );
}
