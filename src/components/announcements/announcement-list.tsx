import Link from "next/link";
import type { BroadcastSummary } from "@/features/messaging/contracts";
import { BroadcastProgressBar, BroadcastStatusPill } from "./broadcast-status";
import {
  formatCount,
  formatWhen,
  handledCount,
  oneLine,
  patientsLabel,
  senderLabel,
  servicesLabel,
} from "./format";

// Past announcements, newest first. Each row opens the progress page; the
// whole row is the link's hit area, while its name stays short.
export function AnnouncementList({
  items,
  basePath,
  timeZone,
  now,
}: {
  items: BroadcastSummary[];
  basePath: string;
  timeZone: string;
  now: number;
}) {
  return (
    <ul className="divide-y divide-divider">
      {items.map((item) => {
        const when = formatWhen(item.createdAt, timeZone, now);
        const { counts } = item;
        return (
          <li
            key={item.id}
            className="relative flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-accent/60"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="line-clamp-2 min-w-0 text-sm font-medium break-words">
                {oneLine(item.body)}
              </p>
              <BroadcastStatusPill status={item.status} />
            </div>
            <p className="text-xs text-muted-foreground">
              {when} · by {senderLabel(item.createdByName)} ·{" "}
              {servicesLabel(item.serviceNames)}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <BroadcastProgressBar counts={counts} className="sm:w-40" />
              <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <Count label="Sent" value={counts.sent} />
                <Count label="Seen" value={counts.seen} />
                <Count label="Skipped" value={counts.skipped} />
                <Count
                  label="Failed"
                  value={counts.failed}
                  alert={counts.failed > 0}
                />
                {item.status === "SENDING" && (
                  <Count label="Pending" value={counts.pending} />
                )}
              </dl>
              <span className="text-xs text-muted-foreground sm:ml-auto">
                {item.status === "SENDING"
                  ? `${formatCount(handledCount(counts))} of ${patientsLabel(counts.total)}`
                  : patientsLabel(counts.total)}
              </span>
            </div>
            <Link
              href={`${basePath}/${item.id}`}
              className="self-start rounded-sm text-sm font-semibold text-brand outline-none after:absolute after:inset-0 hover:underline focus-visible:after:rounded-sm focus-visible:after:ring-3 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset"
            >
              View progress
              <span className="sr-only"> of the announcement from {when}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Count({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: number;
  alert?: boolean;
}) {
  return (
    <div className="flex gap-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={
          alert
            ? "font-semibold text-danger-text tabular-nums"
            : "font-semibold tabular-nums"
        }
      >
        {formatCount(value)}
      </dd>
    </div>
  );
}
