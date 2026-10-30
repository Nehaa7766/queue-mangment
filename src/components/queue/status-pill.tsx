import { cn } from "@/lib/utils";
import type { QueueStatus } from "@/features/queue/queue-rules";
import type { TokenStatus } from "@/features/queue/token-status";
import { QUEUE_STATUS_DISPLAY, TOKEN_STATUS_DISPLAY } from "./token-display";

const PILL =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap";

export function TokenStatusPill({
  status,
  className,
}: {
  status: TokenStatus;
  className?: string;
}) {
  const display = TOKEN_STATUS_DISPLAY[status];
  return (
    <span className={cn(PILL, display.className, className)}>
      {display.label}
    </span>
  );
}

export function QueueStatusPill({
  status,
  className,
}: {
  status: QueueStatus;
  className?: string;
}) {
  const display = QUEUE_STATUS_DISPLAY[status];
  return (
    <span className={cn(PILL, "gap-1.5", display.className, className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {display.label}
    </span>
  );
}
