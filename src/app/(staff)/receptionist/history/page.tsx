import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import {
  RECEPTION_ROLES,
  requireStaffPage,
} from "@/components/layout/staff-session";
import { TokenStatusPill } from "@/components/queue/status-pill";
import {
  TOKEN_STATUS_DISPLAY,
  displayName,
  formatClinicTime,
} from "@/components/queue/token-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  HISTORY_STATUSES,
  getTokenHistory,
  type HistoryFilters,
} from "@/features/analytics/queries";
import { cn } from "@/lib/utils";

type SearchParams = PageProps<"/receptionist/history">["searchParams"];

export default function HistoryPage({
  searchParams,
}: PageProps<"/receptionist/history">) {
  return (
    <Suspense fallback={<HistorySkeleton />}>
      <History searchParams={searchParams} />
    </Suspense>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Unknown or malformed filters are ignored rather than rejected.
function parseFilters(params: Awaited<SearchParams>): HistoryFilters {
  const status = z.enum(HISTORY_STATUSES).safeParse(first(params.status));
  const serviceId = z.uuid().safeParse(first(params.service));
  const search = first(params.q)?.trim().slice(0, 80);
  return {
    status: status.success ? status.data : undefined,
    serviceId: serviceId.success ? serviceId.data : undefined,
    search: search || undefined,
  };
}

async function History({ searchParams }: { searchParams: SearchParams }) {
  const context = await requireStaffPage(RECEPTION_ROLES);
  const filters = parseFilters(await searchParams);
  const history = await getTokenHistory(context.clinic.id, filters);
  const timeZone = context.clinic.timezone;

  // Builds a link that changes one filter and keeps the others.
  const href = (
    change: Partial<Record<"status" | "service" | "q", string | undefined>>,
  ) => {
    const params = new URLSearchParams();
    const next = {
      status: filters.status,
      service: filters.serviceId,
      q: filters.search,
      ...change,
    };
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
    }
    const query = params.toString();
    return query ? `/receptionist/history?${query}` : "/receptionist/history";
  };

  const chip = (label: string, link: string, active: boolean) => (
    <Link
      key={link + label}
      href={link}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        active
          ? "border-slate bg-slate text-white"
          : "border-border bg-card hover:bg-accent",
      )}
    >
      {label}
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Queue history"
        status={`Today's tokens · ${history.tokens.length} shown`}
      />

      <div className="mb-4 flex flex-col gap-3 rounded-card border border-border bg-card p-4">
        <Form
          action="/receptionist/history"
          role="search"
          className="flex gap-2"
        >
          {filters.status && (
            <input type="hidden" name="status" value={filters.status} />
          )}
          {filters.serviceId && (
            <input type="hidden" name="service" value={filters.serviceId} />
          )}
          <Input
            name="q"
            type="search"
            defaultValue={filters.search}
            aria-label="Search by token or patient name"
            placeholder="Token or patient name"
            className="h-10 max-w-sm"
          />
          <Button type="submit" variant="outline" className="h-10 rounded-btn">
            Search
          </Button>
        </Form>
        <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
          {chip("All statuses", href({ status: undefined }), !filters.status)}
          {HISTORY_STATUSES.map((status) =>
            chip(
              TOKEN_STATUS_DISPLAY[status].label,
              href({ status }),
              filters.status === status,
            ),
          )}
        </nav>
        {history.services.length > 1 && (
          <nav aria-label="Filter by service" className="flex flex-wrap gap-2">
            {chip(
              "All services",
              href({ service: undefined }),
              !filters.serviceId,
            )}
            {history.services.map((service) =>
              chip(
                service.serviceName,
                href({ service: service.serviceId }),
                filters.serviceId === service.serviceId,
              ),
            )}
          </nav>
        )}
      </div>

      {history.tokens.length === 0 ? (
        <p className="rounded-card border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          {filters.status || filters.serviceId || filters.search
            ? "No tokens match these filters."
            : "No tokens yet today."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-divider rounded-card border border-border bg-card">
          {history.tokens.map((token) => (
            <li key={token.id}>
              <Link
                href={`/receptionist/tokens/${token.id}`}
                className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="w-14 font-display text-lg font-extrabold tabular-nums">
                  {token.tokenLabel}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {displayName(token.patientName)}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {token.serviceName} · joined{" "}
                    {formatClinicTime(token.joinedAt, timeZone)}
                    {token.calledAt &&
                      ` · called ${formatClinicTime(token.calledAt, timeZone)}`}
                    {token.completedAt &&
                      ` · done ${formatClinicTime(token.completedAt, timeZone)}`}
                  </span>
                </span>
                <TokenStatusPill status={token.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function HistorySkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-28 rounded-card" />
      <Skeleton className="h-80 rounded-card" />
      <span className="sr-only">Loading history…</span>
    </div>
  );
}
