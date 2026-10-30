import { PlayIcon } from "lucide-react";
import { displayName, formatClock } from "@/components/queue/token-display";
import { Button } from "@/components/ui/button";
import type { StaffTokenView } from "@/features/queue/contracts";

// Patients reception has called, ready for the doctor to start. Doctors
// don't call patients themselves (permission matrix), so an empty list says
// so instead of offering a Call next button.
export function CalledPatientList({
  tokens,
  now,
  blockedReason,
  pendingTokenId,
  onStart,
}: {
  tokens: readonly StaffTokenView[];
  now: number;
  blockedReason: string | null;
  pendingTokenId: string | null;
  onStart: (token: StaffTokenView) => void;
}) {
  return (
    <section aria-labelledby="ready-title" className="flex flex-col gap-2">
      <h2
        id="ready-title"
        className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase"
      >
        Ready to start · {tokens.length}
      </h2>
      {tokens.length === 0 ? (
        <p className="rounded-card border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          Waiting for reception to call the next patient. Called patients appear
          here.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tokens.map((token) => {
            const calledFor = token.calledAt
              ? (now - Date.parse(token.calledAt)) / 1000
              : null;
            const reasonId = `start-reason-${token.id}`;
            return (
              <li
                key={token.id}
                className="flex min-h-14 overflow-hidden rounded-[10px] border border-border bg-card"
              >
                <span className="flex w-[68px] shrink-0 items-center justify-center border-r-2 border-dashed border-background bg-status-wait font-display text-lg font-extrabold text-status-wait-foreground tabular-nums">
                  {token.tokenLabel}
                </span>
                <span className="flex min-w-0 flex-1 flex-col justify-center px-3 py-2">
                  <span className="truncate text-sm font-semibold">
                    {displayName(token.patientName)}
                  </span>
                  <span className="truncate text-xs text-muted-foreground tabular-nums">
                    {token.serviceName}
                    {calledFor !== null &&
                      ` · called ${formatClock(calledFor)} ago`}
                  </span>
                </span>
                <span className="flex shrink-0 items-center pr-2">
                  <Button
                    className="h-11 rounded-btn px-4 font-semibold"
                    disabled={blockedReason !== null}
                    aria-describedby={blockedReason ? reasonId : undefined}
                    aria-label={`Start consultation with ${token.tokenLabel}, ${displayName(token.patientName)}`}
                    onClick={() => onStart(token)}
                  >
                    <PlayIcon />
                    {pendingTokenId === token.id ? "Starting…" : "Start"}
                  </Button>
                  {blockedReason && (
                    <span id={reasonId} className="sr-only">
                      {blockedReason}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {tokens.length > 0 && blockedReason && (
        <p className="text-xs text-muted-foreground">{blockedReason}</p>
      )}
    </section>
  );
}
