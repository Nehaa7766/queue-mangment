import type { ReactNode } from "react";
import type { StaffTokenView } from "@/features/queue/contracts";
import { cn } from "@/lib/utils";
import { TokenStatusPill } from "./status-pill";
import { displayName, formatClock } from "./token-display";

export type TicketToken = Pick<
  StaffTokenView,
  | "tokenLabel"
  | "patientName"
  | "serviceName"
  | "status"
  | "calledAt"
  | "assignedDoctorName"
  | "recallCount"
>;

// The "Now serving" ticket stub (docs/GUI_RULES.md §5): slate stub, dashed
// perforation with notches, details and actions on the white body.
export function NowServingTicket({
  token,
  now,
  gracePeriodSeconds,
  actions,
  compact = false,
  className,
}: {
  token: TicketToken | null;
  now: number;
  gracePeriodSeconds: number;
  actions?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  const elapsedSeconds =
    token?.calledAt != null ? (now - Date.parse(token.calledAt)) / 1000 : 0;
  const remainingSeconds = Math.max(0, gracePeriodSeconds - elapsedSeconds);
  const showGrace = token?.status === "CALLED" && gracePeriodSeconds > 0;
  const subtitle = token
    ? [token.serviceName, token.assignedDoctorName].filter(Boolean).join(" · ")
    : null;

  return (
    <section
      aria-label="Now serving"
      className={cn(
        "flex flex-col overflow-hidden rounded-card border border-border bg-card sm:flex-row",
        className,
      )}
    >
      {/* Announced once per change, not on every countdown tick. */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {token
          ? `Now serving ${token.tokenLabel}, ${displayName(token.patientName)}`
          : "No one is being served"}
      </p>

      <div
        className={cn(
          "relative flex shrink-0 flex-col gap-0.5 border-b-2 border-dashed border-background bg-slate px-5 py-4 text-white sm:border-r-2 sm:border-b-0",
          compact ? "sm:w-32" : "sm:w-40",
        )}
      >
        <span className="text-[11px] font-semibold tracking-[0.08em] text-slate-muted uppercase">
          Now serving
        </span>
        <span
          className={cn(
            "font-display font-extrabold tabular-nums",
            compact
              ? "text-[28px]"
              : "text-[44px] leading-tight sm:text-[52px]",
          )}
        >
          {token?.tokenLabel ?? "—"}
        </span>
        {token && (
          <span className="truncate text-sm text-sand">
            {token.status === "IN_SERVICE" ? "With doctor" : "Please come in"}
          </span>
        )}
        {/* Perforation notches: horizontal on phones, vertical from sm. */}
        <span
          aria-hidden
          className="absolute -bottom-[9px] -left-[9px] size-[18px] rounded-full bg-background sm:top-[-9px] sm:right-[-9px] sm:bottom-auto sm:left-auto"
        />
        <span
          aria-hidden
          className="absolute -right-[9px] -bottom-[9px] size-[18px] rounded-full bg-background"
        />
      </div>

      <div
        className={cn(
          "flex flex-1 flex-col gap-3",
          compact ? "p-4" : "p-4 sm:p-5",
        )}
      >
        {token ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {displayName(token.patientName)}
                </p>
                {subtitle && (
                  <p className="truncate text-sm text-muted-foreground">
                    {subtitle}
                  </p>
                )}
              </div>
              {token.status === "CALLED" && token.calledAt ? (
                <span className="shrink-0 rounded-full bg-status-wait px-3 py-1 text-xs font-semibold text-status-wait-foreground tabular-nums">
                  Called {formatClock(elapsedSeconds)}
                  {token.recallCount > 0 && ` · recalled ${token.recallCount}×`}
                </span>
              ) : (
                <TokenStatusPill status={token.status} className="shrink-0" />
              )}
            </div>

            {showGrace && (
              <div className="flex flex-col gap-1.5">
                <div
                  role="progressbar"
                  aria-label="Grace period"
                  aria-valuemin={0}
                  aria-valuemax={gracePeriodSeconds}
                  aria-valuenow={Math.round(remainingSeconds)}
                  aria-valuetext={`${formatClock(remainingSeconds)} left`}
                  className="h-1.5 overflow-hidden rounded-full bg-cream"
                >
                  <div
                    className="h-full rounded-full bg-terracotta transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
                    style={{
                      width: `${(remainingSeconds / gracePeriodSeconds) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {remainingSeconds > 0
                    ? `${formatClock(remainingSeconds)} left in the grace period`
                    : "Grace period over. Recall or skip."}
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No one is being served. Call the next patient when ready.
          </p>
        )}
        {actions}
      </div>
    </section>
  );
}
