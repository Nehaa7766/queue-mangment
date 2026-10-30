import { cn } from "@/lib/utils";
import type { QueueStatus } from "@/features/queue/queue-rules";
import type { TokenStatus } from "@/features/queue/token-status";
import { messages } from "./messages";

// Status styles from docs/GUI_RULES.md §2; always paired with a text label.
const TOKEN_STYLES: Record<TokenStatus, string> = {
  WAITING: "bg-status-wait text-status-wait-foreground",
  CALLED: "bg-status-wait text-status-wait-foreground",
  IN_SERVICE: "bg-brand text-white",
  COMPLETED: "bg-status-done text-status-done-foreground",
  SKIPPED: "bg-status-miss text-status-miss-foreground",
  CANCELLED: "bg-status-off text-status-off-foreground",
};

const QUEUE_STYLES: Record<QueueStatus, string> = {
  OPEN: "bg-status-done text-status-done-foreground",
  PAUSED: "bg-status-off text-status-off-foreground",
  CLOSED: "bg-status-off text-status-off-foreground",
};

// Rounded pill with a small dot in the text colour before the label.
export const PILL =
  "inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold before:size-1.5 before:shrink-0 before:rounded-full before:bg-current";

export function TokenStatusPill({ status }: { status: TokenStatus }) {
  return (
    <span className={cn(PILL, TOKEN_STYLES[status])}>
      {messages.token.statusLabel[status]}
    </span>
  );
}

export function QueueStatusPill({ status }: { status: QueueStatus }) {
  return (
    <span className={cn(PILL, QUEUE_STYLES[status])}>
      {messages.queueStatus[status]}
    </span>
  );
}
