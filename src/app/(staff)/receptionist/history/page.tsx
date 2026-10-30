import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
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
          ? "border-brand bg-brand text-white"
          : "border-border bg-card hover:bg-accent",
      )}
    >
      {label}
    </Link>
  );

  const time = (iso: string | null) =>
    iso ? formatClinicTime(iso, timeZone) : "—";

  return (
    <>
      <PageHeader
        title="Queue history"
        breadcrumbs={[
          { label: "Reception", href: "/receptionist" },
          { label: "Queue history" },
        ]}
        status={`Today's tokens · ${history.tokens.length} shown`}
      />

      <div className="flex flex-col gap-5">
        <DashboardCard title="Filters" bodyClassName="flex flex-col gap-3">
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
            <Button
              type="submit"
              variant="outline"
              className="h-10 rounded-btn"
            >
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
            <nav
              aria-label="Filter by service"
              className="flex flex-wrap gap-2"
            >
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
        </DashboardCard>

        <DashboardCard
          title="Today's tokens"
          description="Newest first. Open a token for its full timeline."
          bodyClassName="p-0"
        >
          {history.tokens.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              {filters.status || filters.serviceId || filters.search
                ? "No tokens match these filters."
                : "No tokens yet today."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="bg-muted text-left text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-5 py-2.5 font-semibold">
                      Token
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">
                      Patient
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">
                      Service
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">
                      Joined
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">
                      Called
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">
                      Done
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {history.tokens.map((token) => (
                    <tr key={token.id} className="hover:bg-accent/60">
                      <td className="px-5 py-3">
                        <Link
                          href={`/receptionist/tokens/${token.id}`}
                          className="rounded-sm font-display text-base font-extrabold text-brand tabular-nums outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          {token.tokenLabel}
                        </Link>
                      </td>
                      <td className="px-3 py-3 font-medium">
                        {displayName(token.patientName)}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {token.serviceName}
                      </td>
                      <td className="px-3 py-3 tabular-nums">
                        {time(token.joinedAt)}
                      </td>
                      <td className="px-3 py-3 tabular-nums">
                        {time(token.calledAt)}
                      </td>
                      <td className="px-3 py-3 tabular-nums">
                        {time(token.completedAt)}
                      </td>
                      <td className="px-5 py-3">
                        <TokenStatusPill status={token.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DashboardCard>
      </div>
    </>
  );
}

function HistorySkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-5">
      <Skeleton className="h-14 rounded-none" />
      <Skeleton className="h-36 rounded-card" />
      <Skeleton className="h-80 rounded-card" />
      <span className="sr-only">Loading history…</span>
    </div>
  );
}
