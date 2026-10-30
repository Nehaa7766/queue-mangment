import Link from "next/link";
import {
  actionLabel,
  type ActivityTarget,
  type PlatformActivity,
} from "@/features/platform/activity";
import { DataTable, HeaderRow, TD, TR } from "./data-table";
import { formatDateTime } from "./pills";
import { EmptyState } from "./section-card";

// Platform audit events as When · Action · Target · By: a table from md up,
// stacked rows on phones. Used by the dashboard and the activity log.
export function ActivityTable({
  events,
  label,
}: {
  events: PlatformActivity[];
  // Names the table for screen readers.
  label: string;
}) {
  if (events.length === 0) {
    return <EmptyState className="m-5">No platform actions yet.</EmptyState>;
  }
  return (
    <>
      <div className="hidden md:block">
        <DataTable label={label} minWidth={640}>
          <HeaderRow
            columns={[
              { label: "When" },
              { label: "Action" },
              { label: "Target" },
              { label: "By" },
            ]}
          />
          <tbody>
            {events.map((event) => (
              <tr key={event.id} className={TR}>
                <td
                  className={`${TD} whitespace-nowrap text-muted-foreground tabular-nums`}
                >
                  <time dateTime={event.createdAt}>
                    {formatDateTime(event.createdAt)}
                  </time>
                </td>
                <td className={`${TD} font-semibold`}>
                  {actionLabel(event.action)}
                </td>
                <td className={TD}>
                  <TargetCell target={event.target} />
                </td>
                <td className={`${TD} text-muted-foreground`}>
                  {event.actorName ?? "System"}
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </div>

      <ul aria-label={label} className="divide-y divide-divider md:hidden">
        {events.map((event) => (
          <li key={event.id} className="flex flex-col gap-1 px-5 py-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold">
                {actionLabel(event.action)}
              </span>
              <time
                dateTime={event.createdAt}
                className="shrink-0 text-xs text-muted-foreground tabular-nums"
              >
                {formatDateTime(event.createdAt)}
              </time>
            </div>
            <TargetCell target={event.target} />
            <span className="text-xs text-muted-foreground">
              By {event.actorName ?? "System"}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

function TargetCell({ target }: { target: ActivityTarget }) {
  return (
    <span className="flex min-w-0 flex-col text-sm">
      <span className="text-xs text-muted-foreground">{target.type}</span>
      {target.href ? (
        <Link
          href={target.href}
          className="truncate font-medium text-brand underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {target.label}
        </Link>
      ) : (
        <span className="truncate">{target.label}</span>
      )}
    </span>
  );
}
