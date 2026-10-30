import {
  Building2Icon,
  HourglassIcon,
  LifeBuoyIcon,
  TicketCheckIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import {
  DashboardCard,
  StatStrip,
} from "@/components/dashboard/dashboard-card";
import { ListRow, TokenBadge } from "@/components/dashboard/list-row";
import { StatCard } from "@/components/dashboard/stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { ActivityTable } from "@/components/platform/activity-table";
import { ClinicGrowthChart } from "@/components/platform/charts/clinic-growth-chart";
import { firstParam } from "@/components/platform/filter-chips";
import { Pagination } from "@/components/platform/pagination";
import { PlatformPageSkeleton } from "@/components/platform/platform-shell";
import { requirePlatformPage } from "@/components/platform/platform-session";
import { RangeTabs } from "@/components/platform/range-tabs";
import { CardLink } from "@/components/platform/section-card";
import { listPlatformActivityPage } from "@/features/platform/activity";
import { getPlatformAnalytics } from "@/features/platform/analytics";
import { parseRange } from "@/features/platform/analytics-shape";
import { getPlatformDashboard } from "@/features/platform/dashboard";
import { parsePage } from "@/features/platform/pagination";

export const metadata: Metadata = { title: "Platform overview · QueueCare" };

export default function PlatformDashboardPage({
  searchParams,
}: PageProps<"/super-admin/dashboard">) {
  return (
    <Suspense fallback={<PlatformPageSkeleton />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

// Rows per page of the dashboard's recent activity; the log has the rest.
const ACTIVITY_PAGE_SIZE = 10;

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

async function Dashboard({
  searchParams,
}: {
  searchParams: PageProps<"/super-admin/dashboard">["searchParams"];
}) {
  await requirePlatformPage();
  const params = await searchParams;
  const range = parseRange(firstParam(params.range));
  const [dashboard, analytics, activity] = await Promise.all([
    getPlatformDashboard(),
    getPlatformAnalytics(range),
    listPlatformActivityPage({
      page: parsePage(firstParam(params.activityPage)),
      pageSize: ACTIVITY_PAGE_SIZE,
    }),
  ]);
  const { clinics } = dashboard;
  const { tokens } = analytics;
  const per = range === 7 ? "day" : "week";
  const byStatus = [
    {
      status: "ACTIVE",
      title: "Active",
      subtitle: "Taking patients",
      count: clinics.active,
    },
    {
      status: "PENDING",
      title: "Pending approval",
      subtitle: "Signed up, waiting for review",
      count: clinics.pending,
    },
    {
      status: "SUSPENDED",
      title: "Suspended",
      subtitle: "Screens and patient page off",
      count: clinics.suspended,
    },
  ];

  return (
    <>
      <PageHeader
        title="Platform overview"
        breadcrumbs={[{ label: "Dashboard" }]}
        status="Clinics, patients served and support across QueueCare."
        actions={<RangeTabs href="/super-admin/dashboard" current={range} />}
      />

      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Building2Icon}
            value={clinics.active}
            label="Active clinics"
            footerLabel="Of all clinics"
            footerValue={`${clinics.active} of ${clinics.total} (${percent(clinics.active, clinics.total)}%)`}
            progress={percent(clinics.active, clinics.total)}
            tone="brand"
          />
          <StatCard
            icon={HourglassIcon}
            value={clinics.pending}
            label="Pending approval"
            footerLabel="New sign-ups waiting"
            footerValue={`${clinics.suspended} suspended`}
            progress={percent(clinics.pending, clinics.total)}
            tone="tan"
            action={
              <CardLink href="/super-admin/clinics?status=PENDING">
                Review
              </CardLink>
            }
          />
          <StatCard
            icon={TicketCheckIcon}
            value={tokens.served}
            label="Patients served"
            footerLabel={`Last ${range} days, of tokens issued`}
            footerValue={`${tokens.served} of ${tokens.issued}`}
            progress={percent(tokens.served, tokens.issued)}
            tone="rose"
          />
          <StatCard
            icon={LifeBuoyIcon}
            value={dashboard.openTickets}
            label="Open tickets"
            footerLabel="In progress"
            footerValue={`${dashboard.ticketsInProgress} of ${dashboard.openTickets}`}
            progress={percent(
              dashboard.ticketsInProgress,
              dashboard.openTickets,
            )}
            tone="amber"
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <DashboardCard
            title="Clinic growth"
            description={`New sign-ups and approvals per ${per}, last ${range} days.`}
            className="lg:col-span-2"
            footer={
              <StatStrip
                stats={[
                  {
                    label: "New sign-ups",
                    value: analytics.growth.totals.signups,
                    tone: "brand",
                  },
                  {
                    label: "Approved",
                    value: analytics.growth.totals.approved,
                    tone: "tan",
                  },
                  {
                    label: "Suspended",
                    value: analytics.growth.totals.suspended,
                    tone: "red",
                  },
                  {
                    label: "Active now",
                    value: analytics.growth.totals.activeNow,
                    tone: "rose",
                  },
                ]}
              />
            }
          >
            <ClinicGrowthChart points={analytics.growth.points} />
          </DashboardCard>

          <DashboardCard
            title="Clinics by status"
            description={`${clinics.total} ${clinics.total === 1 ? "clinic" : "clinics"} on QueueCare today.`}
            action={
              <CardLink href="/super-admin/clinics">All clinics</CardLink>
            }
          >
            <div className="flex flex-col divide-y divide-divider">
              {byStatus.map((row) => (
                <ListRow
                  key={row.status}
                  href={`/super-admin/clinics?status=${row.status}`}
                  leading={
                    <TokenBadge
                      label={String(row.count)}
                      tone={row.status === "ACTIVE" ? "brand" : "muted"}
                    />
                  }
                  title={row.title}
                  subtitle={row.subtitle}
                  trailing={`${percent(row.count, clinics.total)}%`}
                />
              ))}
            </div>
          </DashboardCard>
        </div>

        <DashboardCard
          id="recent-activity"
          title="Recent activity"
          description="The latest platform admin actions and sign-ups."
          bodyClassName="p-0"
          action={
            <CardLink href="/super-admin/activity">Activity log</CardLink>
          }
        >
          <ActivityTable
            events={activity.rows}
            label="Recent platform activity"
          />
          <Pagination
            result={activity}
            href={(page) =>
              `/super-admin/dashboard?range=${range}&activityPage=${page}#recent-activity`
            }
          />
        </DashboardCard>
      </div>
    </>
  );
}
