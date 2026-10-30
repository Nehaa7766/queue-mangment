import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { AdminSection, NativeSelect } from "@/components/admin/admin-ui";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { requireStaffPage } from "@/components/layout/staff-session";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAuditLog } from "@/features/analytics/admin-queries";
import {
  AUDIT_CATEGORIES,
  AUDIT_CATEGORY_LABELS,
  parseAuditFilters,
} from "@/features/analytics/audit-log";
import { formatDayLabel } from "@/features/analytics/range-time";
import { cn } from "@/lib/utils";

type SearchParams = PageProps<"/admin/audit">["searchParams"];

export default function AdminAuditPage({
  searchParams,
}: PageProps<"/admin/audit">) {
  return (
    <Suspense fallback={<AdminPageSkeleton label="Loading the audit log…" />}>
      <Audit searchParams={searchParams} />
    </Suspense>
  );
}

function first(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

// States are enum names like "CLINIC_ADMIN"; show them as words.
function readable(state: string | null): string | null {
  return state ? state.toLowerCase().replaceAll("_", " ") : null;
}

async function Audit({ searchParams }: { searchParams: SearchParams }) {
  const context = await requireStaffPage(["CLINIC_ADMIN"]);
  const params = await searchParams;
  const filters = parseAuditFilters({
    date: first(params.date),
    actor: first(params.actor),
    category: first(params.category),
  });
  const log = await getAuditLog(context.clinic.id, filters);
  const filtered = Boolean(
    filters.date || filters.actorUserId || filters.category,
  );

  return (
    <>
      <PageHeader
        title="Audit activity"
        status="Every staff action that changes the queue, staff or settings."
        search={false}
      />

      <AdminSection title="Filter" className="mb-3.5">
        <Form
          action="/admin/audit"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)_auto_auto] lg:items-end"
        >
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Date
            <Input
              type="date"
              name="date"
              defaultValue={filters.date ?? ""}
              className="h-10"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Staff member
            <NativeSelect name="actor" defaultValue={filters.actorUserId ?? ""}>
              <option value="">Anyone</option>
              {log.actors.map((actor) => (
                <option key={actor.userId} value={actor.userId}>
                  {actor.name}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Area
            <NativeSelect name="category" defaultValue={filters.category ?? ""}>
              <option value="">Everything</option>
              {AUDIT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {AUDIT_CATEGORY_LABELS[category]}
                </option>
              ))}
            </NativeSelect>
          </label>
          <Button type="submit" className="h-10 rounded-btn px-5 font-semibold">
            Apply
          </Button>
          {filtered && (
            <Link
              href="/admin/audit"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-10 rounded-btn",
              )}
            >
              Clear
            </Link>
          )}
        </Form>
      </AdminSection>

      <AdminSection
        title={filtered ? "Matching activity" : "Latest activity"}
        description={
          log.truncated
            ? `Showing the newest ${log.entries.length}. Pick a date or person to see older entries.`
            : `${log.entries.length} ${log.entries.length === 1 ? "entry" : "entries"}`
        }
      >
        {log.entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {filtered ? "Nothing matches these filters." : "No activity yet."}
          </p>
        ) : (
          <ol className="flex flex-col divide-y divide-divider">
            {log.entries.map((entry) => {
              const from = readable(entry.previousState);
              const to = readable(entry.newState);
              return (
                <li
                  key={entry.id}
                  className="grid gap-1 py-2.5 sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:gap-3"
                >
                  <time
                    dateTime={entry.createdAt}
                    className="text-xs text-muted-foreground tabular-nums sm:pt-0.5"
                  >
                    {formatDayLabel(entry.date)}, {entry.time}
                  </time>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {entry.label}
                      {entry.tokenLabel && (
                        <span className="ml-1.5 font-display font-extrabold tabular-nums">
                          {entry.tokenLabel}
                        </span>
                      )}
                    </p>
                    {(from || to) && (
                      <p className="text-xs text-muted-foreground">
                        {from && to ? `${from} → ${to}` : (to ?? from)}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground sm:text-right">
                    {entry.actorName ?? "Patient or system"}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </AdminSection>
    </>
  );
}
