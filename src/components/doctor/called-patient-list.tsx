import { PlayIcon } from "lucide-react";
import { TokenBadge } from "@/components/dashboard/list-row";
import { displayName, formatClock } from "@/components/queue/token-display";
import { Button } from "@/components/ui/button";
import type { StaffTokenView } from "@/features/queue/contracts";
import { cn } from "@/lib/utils";

// Start for one called patient. While Start is blocked, the reason is read
// out with the button and shown under the list.
export function StartButton({
  token,
  blockedReason,
  pending,
  onStart,
  className,
}: {
  token: Pick<StaffTokenView, "id" | "tokenLabel" | "patientName">;
  blockedReason: string | null;
  pending: boolean;
  onStart: () => void;
  className?: string;
}) {
  const reasonId = `start-reason-${token.id}`;
  return (
    <>
      <Button
        className={cn("h-10 rounded-btn px-4 font-semibold", className)}
        disabled={blockedReason !== null}
        aria-describedby={blockedReason ? reasonId : undefined}
        aria-label={`Start consultation with ${token.tokenLabel}, ${displayName(token.patientName)}`}
        onClick={onStart}
      >
        <PlayIcon />
        {pending ? "Starting…" : "Start"}
      </Button>
      {blockedReason && (
        <span id={reasonId} className="sr-only">
          {blockedReason}
        </span>
      )}
    </>
  );
}

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
  if (tokens.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-muted-foreground">
        Waiting for reception to call the next patient. Called patients appear
        here.
      </p>
    );
  }
  return (
    <div className="flex flex-col">
      <ul className="divide-y divide-divider px-5">
        {tokens.map((token) => {
          const calledFor = token.calledAt
            ? (now - Date.parse(token.calledAt)) / 1000
            : null;
          return (
            <li key={token.id} className="flex items-center gap-3 py-3.5">
              <TokenBadge label={token.tokenLabel} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold">
                  {displayName(token.patientName)}
                </span>
                <span className="truncate text-xs text-muted-foreground tabular-nums">
                  {token.serviceName}
                  {calledFor !== null &&
                    ` · called ${formatClock(calledFor)} ago`}
                </span>
              </span>
              <StartButton
                token={token}
                blockedReason={blockedReason}
                pending={pendingTokenId === token.id}
                onStart={() => onStart(token)}
                className="shrink-0"
              />
            </li>
          );
        })}
      </ul>
      {blockedReason && (
        <p className="px-5 pb-4 text-xs text-muted-foreground">
          {blockedReason}
        </p>
      )}
    </div>
  );
}
