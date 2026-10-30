import { ClockIcon, UserCheckIcon, UsersIcon, UserXIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import {
  AdminSection,
  DataTable,
  DataTableBody,
  DataTableHead,
  RowTh,
  Td,
  Th,
} from "@/components/admin/admin-ui";
import { DailyActivityChart } from "@/components/admin/daily-activity-chart";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import {
  DashboardCard,
  StatStrip,
} from "@/components/dashboard/dashboard-card";
import { HighlightCard } from "@/components/dashboard/highlight-card";
import { ListRow } from "@/components/dashboard/list-row";
import { StatCard } from "@/components/dashboard/stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { requireStaffPage } from "@/components/layout/staff-session";
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

function percent(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

// Today / 7 days / 30 days, as a segmented control in the page header.
function RangeSwitch({ range }: { range: AnalyticsRange }) {
  return (
    <nav
      aria-label="Date range"
      className="inline-flex h-9 items-center rounded-btn border border-border bg-background p-0.5"
    >
      {ANALYTICS_RANGES.map((option) => (
        <Link
          key={option}
          href={`/admin/analytics?range=${option}`}
          aria-current={option === range ? "page" : undefined}
          className={cn(
            "inline-flex h-full items-center rounded-[6px] px-3 text-xs font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            option === range
              ? "bg-brand text-white"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {RANGE_LABELS[option]}
        </Link>
      ))}
    </nav>
  );
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
  const finished = totals.completed + totals.noShows;

  return (
    <>
      <PageHeader
        title="Analytics and reports"
        breadcrumbs={[{ label: "Admin" }, { label: "Analytics" }]}
        status={period}
        actions={<RangeSwitch range={range} />}
      />

      <div className="flex flex-col gap-5">
        <section
          aria-label="Totals"
          className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4"
        >
          <StatCard
            icon={UsersIcon}
            value={totals.joined}
            label="Patients joined"
            footerLabel="By QR code"
            footerValue={`${totals.qrJoins} (${percent(totals.qrJoins, totals.joined)}%)`}
            progress={percent(totals.qrJoins, totals.joined)}
            tone="brand"
          />
          <StatCard
            icon={UserCheckIcon}
            value={totals.completed}
            label="Consultations completed"
            footerLabel="Average consultation"
            footerValue={minutes(totals.averageConsultationMinutes)}
            progress={percent(totals.completed, totals.joined)}
            tone="green"
          />
          <StatCard
            icon={ClockIcon}
            value={minutes(totals.averageWaitMinutes)}
            label="Average wait"
            footerLabel={`Median ${minutes(totals.medianWaitMinutes)} · target ${view.waitTargetMinutes}m`}
            footerValue={
              totals.averageWaitMinutes === null
                ? "No calls yet"
                : totals.averageWaitMinutes > view.waitTargetMinutes
                  ? "Over target"
                  : "Within target"
            }
            progress={percent(
              totals.averageWaitMinutes ?? 0,
              view.waitTargetMinutes,
            )}
            tone={
              (totals.averageWaitMinutes ?? 0) > view.waitTargetMinutes
                ? "red"
                : "amber"
            }
          />
          <StatCard
            icon={UserXIcon}
            value={totals.noShowRate === null ? "—" : `${totals.noShowRate}%`}
            label="No-show rate"
            footerLabel="No-shows · cancelled"
            footerValue={`${totals.noShows} of ${finished} · ${totals.cancelled}`}
            progress={totals.noShowRate ?? 0}
            tone="red"
          />
        </section>

        <div className="grid gap-5 xl:grid-cols-3">
          {view.days.length > 1 ? (
            <DashboardCard
              title="Day by day"
              description={period}
              className="xl:col-span-2"
              footer={
                <StatStrip
                  stats={[
                    { label: "Joined", value: totals.joined, tone: "rose" },
                    {
                      label: "Served",
                      value: totals.completed,
                      tone: "brand",
                    },
                    { label: "No-shows", value: totals.noShows, tone: "red" },
                    {
                      label: "Average wait",
                      value: minutes(totals.averageWaitMinutes),
                      tone: "amber",
                    },
                  ]}
                />
              }
            >
              <DailyActivityChart data={view.daily} />
            </DashboardCard>
          ) : (
            <DashboardCard
              title="Today so far"
              description="Pick 7 or 30 days for the daily chart."
              className="xl:col-span-2"
              footer={
                <StatStrip
                  stats={[
                    { label: "Joined", value: totals.joined, tone: "rose" },
                    {
                      label: "Served",
                      value: totals.completed,
                      tone: "brand",
                    },
                    { label: "No-shows", value: totals.noShows, tone: "red" },
                    {
                      label: "Average wait",
                      value: minutes(totals.averageWaitMinutes),
                      tone: "amber",
                    },
                  ]}
                />
              }
            >
              <p className="text-sm text-muted-foreground">
                {totals.joined === 0
                  ? "Nobody has joined today yet."
                  : `${totals.joined} joined, ${totals.completed} served and ${totals.noShows} marked as no-shows so far today.`}
              </p>
            </DashboardCard>
          )}

          <HighlightCard
            value={totals.qrJoins}
            label="Joined by QR code"
            badge={`${percent(totals.qrJoins, totals.joined)}%`}
            series={view.daily.map((day) => day.joined)}
            footer={{ href: "/admin/qr-code", label: "Print the QR poster" }}
          >
            <ListRow
              title="QR code joins"
              subtitle="Patients who scanned and joined themselves"
              trailing={totals.qrJoins}
            />
            <ListRow
              title="Walk-ins"
              subtitle="Registered by reception"
              trailing={totals.walkIns}
            />
            <ListRow
              title="Cancelled"
              subtitle="Left the queue before being called"
              trailing={totals.cancelled}
            />
          </HighlightCard>
        </div>

        <AdminSection title="By service" flush>
          {view.byService.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              No patients in this period yet.
            </p>
          ) : (
            <DataTable caption="Patients and waits by service">
              <DataTableHead>
                <tr>
                  <Th>Service</Th>
                  <Th align="right">Joined</Th>
                  <Th align="right">Completed</Th>
                  <Th align="right">No-shows</Th>
                  <Th align="right">Avg wait</Th>
                  <Th align="right">Median wait</Th>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {view.byService.map((row) => (
                  <tr key={row.serviceId}>
                    <RowTh>{row.serviceName}</RowTh>
                    <Td align="right">{row.joined}</Td>
                    <Td align="right">{row.completed}</Td>
                    <Td align="right">{row.noShows}</Td>
                    <Td align="right">{minutes(row.averageWaitMinutes)}</Td>
                    <Td align="right">{minutes(row.medianWaitMinutes)}</Td>
                  </tr>
                ))}
              </DataTableBody>
            </DataTable>
          )}
        </AdminSection>

        {view.days.length > 1 && (
          <AdminSection title="Daily numbers" flush>
            <DataTable caption="Patients and waits by day" minWidth={480}>
              <DataTableHead>
                <tr>
                  <Th>Day</Th>
                  <Th align="right">Joined</Th>
                  <Th align="right">Completed</Th>
                  <Th align="right">No-shows</Th>
                  <Th align="right">Avg wait</Th>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {[...view.daily].reverse().map((day) => (
                  <tr key={day.date}>
                    <RowTh className="font-normal">{day.label}</RowTh>
                    <Td align="right">{day.joined}</Td>
                    <Td align="right">{day.completed}</Td>
                    <Td align="right">{day.noShows}</Td>
                    <Td align="right">{minutes(day.averageWaitMinutes)}</Td>
                  </tr>
                ))}
              </DataTableBody>
            </DataTable>
          </AdminSection>
        )}

        <p className="text-xs text-muted-foreground">
          Days follow the clinic&apos;s time zone (
          {view.timezone.replaceAll("_", " ")}). Waits run from joining to the
          latest call.
        </p>
      </div>
    </>
  );
}
