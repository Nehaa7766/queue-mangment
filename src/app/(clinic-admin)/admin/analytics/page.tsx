import { ClockIcon, UserCheckIcon, UsersIcon, UserXIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { AdminSection } from "@/components/admin/admin-ui";
import { DailyActivityChart } from "@/components/admin/daily-activity-chart";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { requireStaffPage } from "@/components/layout/staff-session";
import { KpiCard } from "@/components/queue/kpi-card";
import {
  ANALYTICS_RANGES,
  RANGE_LABELS,
  type AnalyticsRange,
} from "@/features/analytics/admin-analytics";
import { getAdminAnalytics } from "@/features/analytics/admin-queries";
import { formatDayLabel } from "@/features/analytics/range-time";
import { cn } from "@/lib/utils";

type SearchParams = PageProps<"/admin/analytics">["searchParams"];

export default function AdminAnalyticsPage({
  searchParams,
}: PageProps<"/admin/analytics">) {
  return (
    <Suspense
      fallback={<AdminPageSkeleton label="Loading analytics…" cards={3} />}
    >
      <Analytics searchParams={searchParams} />
    </Suspense>
  );
}

const rangeSchema = z.enum(ANALYTICS_RANGES).catch("7d");

function minutes(value: number | null): string {
  return value === null ? "—" : `${value}m`;
}

async function Analytics({ searchParams }: { searchParams: SearchParams }) {
  const context = await requireStaffPage(["CLINIC_ADMIN"]);
  const params = await searchParams;
  const range: AnalyticsRange = rangeSchema.parse(
    Array.isArray(params.range) ? params.range[0] : params.range,
  );
  const view = await getAdminAnalytics(context.clinic.id, range);
  const { totals } = view;
  const period =
    view.days.length === 1
      ? formatDayLabel(view.days[0])
      : `${formatDayLabel(view.days[0])} – ${formatDayLabel(view.days.at(-1)!)}`;

  return (
    <>
      <PageHeader
        title="Analytics and reports"
        status={period}
        search={false}
      />

      <nav aria-label="Date range" className="mb-3.5 flex flex-wrap gap-2">
        {ANALYTICS_RANGES.map((option) => (
          <Link
            key={option}
            href={`/admin/analytics?range=${option}`}
            aria-current={option === range ? "page" : undefined}
            className={cn(
              "inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              option === range
                ? "border-slate bg-slate text-white"
                : "border-border bg-card hover:bg-accent",
            )}
          >
            {RANGE_LABELS[option]}
          </Link>
        ))}
      </nav>

      <section
        aria-label="Totals"
        className="grid grid-cols-2 gap-3.5 lg:grid-cols-4"
      >
        <KpiCard
          label="Patients joined"
          value={totals.joined}
          icon={UsersIcon}
          caption={`${totals.qrJoins} by QR · ${totals.walkIns} walk-ins`}
        />
        <KpiCard
          label="Consultations completed"
          value={totals.completed}
          icon={UserCheckIcon}
          caption={`Average ${minutes(totals.averageConsultationMinutes)} each`}
        />
        <KpiCard
          label="Wait (average · median)"
          value={`${minutes(totals.averageWaitMinutes)} · ${minutes(totals.medianWaitMinutes)}`}
          icon={ClockIcon}
          caption="From joining to being called"
        />
        <KpiCard
          label="No-shows"
          value={totals.noShows}
          icon={UserXIcon}
          caption={
            totals.noShowRate === null
              ? `${totals.cancelled} cancelled`
              : `${totals.noShowRate}% of finished · ${totals.cancelled} cancelled`
          }
        />
      </section>

      {view.days.length > 1 && (
        <AdminSection title="Day by day" className="mt-3.5">
          <DailyActivityChart data={view.daily} />
        </AdminSection>
      )}

      <AdminSection title="By service" className="mt-3.5">
        {view.byService.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No patients in this period yet.
          </p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <table className="w-full min-w-[560px] text-sm">
              <caption className="sr-only">
                Patients and waits by service
              </caption>
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Service
                  </th>
                  <th
                    scope="col"
                    className="px-2 py-2 text-right font-semibold"
                  >
                    Joined
                  </th>
                  <th
                    scope="col"
                    className="px-2 py-2 text-right font-semibold"
                  >
                    Completed
                  </th>
                  <th
                    scope="col"
                    className="px-2 py-2 text-right font-semibold"
                  >
                    No-shows
                  </th>
                  <th
                    scope="col"
                    className="px-2 py-2 text-right font-semibold"
                  >
                    Avg wait
                  </th>
                  <th
                    scope="col"
                    className="py-2 pl-2 text-right font-semibold"
                  >
                    Median wait
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider tabular-nums">
                {view.byService.map((row) => (
                  <tr key={row.serviceId}>
                    <th
                      scope="row"
                      className="py-2.5 pr-3 text-left font-semibold"
                    >
                      {row.serviceName}
                    </th>
                    <td className="px-2 py-2.5 text-right">{row.joined}</td>
                    <td className="px-2 py-2.5 text-right">{row.completed}</td>
                    <td className="px-2 py-2.5 text-right">{row.noShows}</td>
                    <td className="px-2 py-2.5 text-right">
                      {minutes(row.averageWaitMinutes)}
                    </td>
                    <td className="py-2.5 pl-2 text-right">
                      {minutes(row.medianWaitMinutes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminSection>

      {view.days.length > 1 && (
        <AdminSection title="Daily numbers" className="mt-3.5">
          <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <table className="w-full min-w-[480px] text-sm">
              <caption className="sr-only">Patients and waits by day</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Day
                  </th>
                  <th
                    scope="col"
                    className="px-2 py-2 text-right font-semibold"
                  >
                    Joined
                  </th>
                  <th
                    scope="col"
                    className="px-2 py-2 text-right font-semibold"
                  >
                    Completed
                  </th>
                  <th
                    scope="col"
                    className="px-2 py-2 text-right font-semibold"
                  >
                    No-shows
                  </th>
                  <th
                    scope="col"
                    className="py-2 pl-2 text-right font-semibold"
                  >
                    Avg wait
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider tabular-nums">
                {[...view.daily].reverse().map((day) => (
                  <tr key={day.date}>
                    <th scope="row" className="py-2 pr-3 text-left font-normal">
                      {day.label}
                    </th>
                    <td className="px-2 py-2 text-right">{day.joined}</td>
                    <td className="px-2 py-2 text-right">{day.completed}</td>
                    <td className="px-2 py-2 text-right">{day.noShows}</td>
                    <td className="py-2 pl-2 text-right">
                      {minutes(day.averageWaitMinutes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminSection>
      )}

      <p className="mt-3.5 text-xs text-muted-foreground">
        Days follow the clinic&apos;s time zone (
        {view.timezone.replaceAll("_", " ")}). Waits run from joining to the
        latest call.
      </p>
    </>
  );
}
