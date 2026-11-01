import { LoaderCircleIcon } from "lucide-react";
import { Pill } from "@/components/admin/admin-ui";
import type {
  BroadcastRecipientStatus,
  BroadcastSummary,
} from "@/features/messaging/contracts";
import { cn } from "@/lib/utils";
import {
  BROADCAST_STATUS_DISPLAY,
  RECIPIENT_STATUS_DISPLAY,
  percent,
} from "./format";

export function BroadcastStatusPill({
  status,
}: {
  status: BroadcastSummary["status"];
}) {
  const display = BROADCAST_STATUS_DISPLAY[status];
  return (
    <Pill tone={display.tone} className="gap-1.5">
      {status === "SENDING" && (
        <LoaderCircleIcon
          aria-hidden
          className="size-3.5 motion-safe:animate-spin"
        />
      )}
      {display.label}
    </Pill>
  );
}

export function RecipientStatusPill({
  status,
}: {
  status: BroadcastRecipientStatus;
}) {
  const display = RECIPIENT_STATUS_DISPLAY[status];
  return <Pill tone={display.tone}>{display.label}</Pill>;
}

// Stacked bar: sent, skipped and failed out of the total, with the pending
// rest as the empty track. Decoration only: the numbers are always in text
// next to it.
export function BroadcastProgressBar({
  counts,
  className,
}: {
  counts: BroadcastSummary["counts"];
  className?: string;
}) {
  const segments = [
    { key: "sent", value: counts.sent, className: "bg-brand" },
    { key: "skipped", value: counts.skipped, className: "bg-tan" },
    { key: "failed", value: counts.failed, className: "bg-tone-red" },
  ];
  return (
    <div
      aria-hidden
      className={cn(
        "flex h-1.5 overflow-hidden rounded-full bg-muted",
        className,
      )}
    >
      {segments.map((segment) =>
        segment.value > 0 ? (
          <div
            key={segment.key}
            className={cn(
              "h-full motion-safe:transition-[width] motion-safe:duration-500",
              segment.className,
            )}
            style={{ width: `${percent(segment.value, counts.total)}%` }}
          />
        ) : null,
      )}
    </div>
  );
}
