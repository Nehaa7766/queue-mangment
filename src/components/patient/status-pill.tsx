import { cn } from "@/lib/utils";
import type { QueueStatus } from "@/features/queue/queue-rules";
import type { TokenStatus } from "@/features/queue/token-status";
import { messages } from "./messages";

// Status styles from docs/GUI_RULES.md §2; always paired with a text label.
const TOKEN_STYLES: Record<TokenStatus, string> = {
  WAITING: "bg-status-wait text-status-wait-foreground",
  CALLED: "bg-status-wait text-status-wait-foreground",
  IN_SERVICE: "bg-slate text-white",
  COMPLETED: "bg-status-done text-status-done-foreground",
  SKIPPED: "bg-status-miss text-status-miss-foreground",
  CANCELLED: "bg-status-off text-status-off-foreground",
};

const QUEUE_STYLES: Record<QueueStatus, string> = {
  OPEN: "bg-status-done text-status-done-foreground",
  PAUSED: "bg-status-off text-status-off-foreground",
  CLOSED: "bg-status-off text-status-off-foreground",
};

const PILL =
  "inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold";

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
