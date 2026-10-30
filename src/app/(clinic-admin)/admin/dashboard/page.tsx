import {
  ActivityIcon,
  CalendarDaysIcon,
  ChartColumnIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  ClipboardListIcon,
  ClockIcon,
  QrCodeIcon,
  UserCheckIcon,
  UsersIcon,
  UserXIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Pill, type PillTone } from "@/components/admin/admin-ui";
import { DailyActivityChart } from "@/components/admin/daily-activity-chart";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import {
  DashboardCard,
  StatStrip,
} from "@/components/dashboard/dashboard-card";
import { HighlightCard } from "@/components/dashboard/highlight-card";
import { ListRow, TokenBadge } from "@/components/dashboard/list-row";
import { SparkCard } from "@/components/dashboard/spark-card";
import { StatCard } from "@/components/dashboard/stat-card";
import type { Tone } from "@/components/dashboard/tone";
import { PageHeader } from "@/components/layout/page-header";
import { requireStaffPage } from "@/components/layout/staff-session";
import { buttonVariants } from "@/components/ui/button";
import {
  getAdminDashboard,
  getAdminOverview,
  type AdminOverview,
} from "@/features/analytics/admin-queries";
import { formatDayLabel } from "@/features/analytics/range-time";
import { cn } from "@/lib/utils";

export default function AdminDashboardPage() {
  return (
    <Suspense
      fallback={<AdminPageSkeleton label="Loading the dashboard…" cards={3} />}
    >
      <AdminDashboard />
    </Suspense>
  );
}

function minutes(value: number | null): string {
  return value === null ? "—" : `${value}m`;
}

function percent(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

// Cycled across the per-service trend cards: the brand palette.
const SERVICE_TONES: Tone[] = ["brand", "tan", "rose"];

async function AdminDashboard() {
  const context = await requireStaffPage(["CLINIC_ADMIN"]);
  const [overview, dashboard] = await Promise.all([
    getAdminOverview(context.clinic.id),
    getAdminDashboard(context.clinic.id),
  ]);
  const today = dashboard.today.totals;
  const week = dashboard.week.totals;
  const month = dashboard.month.totals;
  const target = dashboard.waitTargetMinutes;
  const dailyAverageServed = Math.round(week.completed / 7);
  const overTarget =
    today.averageWaitMinutes !== null && today.averageWaitMinutes > target;
  const prefixes = new Map(
    dashboard.services.map((service) => [
      service.serviceId,
      service.tokenPrefix,
    ]),
  );

  return (
    <>
      <PageHeader
        title="Admin dashboard"
        breadcrumbs={[{ label: "Dashboard" }]}
        actions={
          <Link
            href="/admin/analytics"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-9 rounded-btn",
            )}
          >
            <ChartColumnIcon aria-hidden />
            Reports
          </Link>
        }
      />

      <div className="flex flex-col gap-5">
        <section
          aria-label="Today at a glance"
          className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4"
        >
          <StatCard
            icon={UsersIcon}
            value={today.joined}
            label="Patients today"
            footerLabel="Served so far"
            footerValue={`${today.completed} (${percent(today.completed, today.joined)}%)`}
            progress={percent(today.completed, today.joined)}
            tone="brand"
          />
          <StatCard
            icon={UserCheckIcon}
            value={today.completed}
            label="Served today"
            footerLabel="Daily average, last 7 days"
            footerValue={dailyAverageServed}
            progress={percent(today.completed, Math.max(dailyAverageServed, 1))}
            tone="green"
          />
          <StatCard
            icon={ClockIcon}
            value={minutes(today.averageWaitMinutes)}
            label="Average wait today"
            footerLabel={`Target ${target}m`}
            footerValue={
              today.averageWaitMinutes === null
                ? "No calls yet"
                : overTarget
                  ? `${today.averageWaitMinutes - target}m over`
                  : "Within target"
            }
            progress={percent(today.averageWaitMinutes ?? 0, target)}
            tone={overTarget ? "red" : "amber"}
          />
          <StatCard
            icon={UserXIcon}
            value={today.noShowRate === null ? "—" : `${today.noShowRate}%`}
            label="No-show rate today"
            footerLabel="No-shows"
            footerValue={`${today.noShows} of ${today.completed + today.noShows} finished`}
            progress={today.noShowRate ?? 0}
            tone="red"
          />
        </section>

        <div className="grid gap-5 xl:grid-cols-3">
          <DashboardCard
            title="Patients in the last 7 days"
            description={`${formatDayLabel(dashboard.week.days[0])} – ${formatDayLabel(dashboard.week.days.at(-1)!)}`}
            className="xl:col-span-2"
            action={
              <Link
                href="/admin/analytics?range=7d"
                className="text-xs font-semibold text-brand hover:underline"
              >
                Details
              </Link>
            }
            footer={
              <StatStrip
                stats={[
                  { label: "Joined", value: week.joined, tone: "rose" },
                  { label: "Served", value: week.completed, tone: "brand" },
                  { label: "No-shows", value: week.noShows, tone: "red" },
                  {
                    label: "Average wait",
                    value: minutes(week.averageWaitMinutes),
                    tone: "amber",
                  },
                ]}
              />
            }
          >
            <DailyActivityChart data={dashboard.week.daily} />
          </DashboardCard>

          <HighlightCard
            value={month.completed}
            label="Served in the last 30 days"
            badge={`${percent(month.completed, month.joined)}% of joins`}
            series={dashboard.month.daily.map((day) => day.completed)}
            footer={{
              href: "/admin/analytics?range=30d",
              label: "Open analytics",
            }}
          >
            {dashboard.month.byService.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No patients in the last 30 days yet.
              </p>
            ) : (
              dashboard.month.byService
                .slice(0, 4)
                .map((service) => (
                  <ListRow
                    key={service.serviceId}
                    leading={
                      <TokenBadge
                        label={
                          prefixes.get(service.serviceId) ??
                          service.serviceName.slice(0, 1).toUpperCase()
                        }
                      />
                    }
                    title={service.serviceName}
                    subtitle={`${service.joined} joined · ${minutes(service.averageWaitMinutes)} average wait`}
                    trailing={service.completed}
                    trailingSub="served"
                  />
                ))
            )}
          </HighlightCard>
        </div>

        {dashboard.services.length > 0 && (
          <section
            aria-label="Services today"
            className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
          >
            {dashboard.services.map((service, index) => (
              <SparkCard
                key={service.serviceId}
                icon={ClipboardListIcon}
                title={`${service.serviceName} (${service.tokenPrefix})`}
                subtitle="Served of joined today"
                value={`${service.completedToday}/${service.joinedToday}`}
                series={service.joinedByDay}
                tone={SERVICE_TONES[index % SERVICE_TONES.length]}
                trend={{
                  label:
                    service.changeVsYesterday === 0
                      ? "Same"
                      : `${service.changeVsYesterday > 0 ? "+" : "−"}${Math.abs(service.changeVsYesterday)} joined`,
                  caption: "vs yesterday",
                }}
              />
            ))}
          </section>
        )}

        <div className="grid gap-5 xl:grid-cols-3">
          <RecentChanges overview={overview} />
          <DoctorsToday doctors={overview.doctors} />
        </div>

        <SetupChecklist overview={overview} />
      </div>
    </>
  );
}

const CHANGE_ICONS: Record<string, LucideIcon> = {
  service: ClipboardListIcon,
  staff: UsersIcon,
  clinic: ActivityIcon,
};

function RecentChanges({ overview }: { overview: AdminOverview }) {
  return (
    <DashboardCard
      title="Recent changes"
      description="Services, staff and settings. Queue activity is on the reception dashboard."
      className="xl:col-span-2"
      bodyClassName="py-0"
      action={
        <Link
          href="/admin/audit"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-9 rounded-btn",
          )}
        >
          Full audit log
        </Link>
      }
    >
      {overview.recentChanges.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No changes yet.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-divider">
          {overview.recentChanges.map((change) => {
            const Icon =
              CHANGE_ICONS[change.action.split(".")[0] ?? ""] ?? ActivityIcon;
            return (
              <li key={change.id}>
                <ListRow
                  leading={
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand">
                      <Icon className="size-4" aria-hidden />
                    </span>
                  }
                  title={change.label}
                  subtitle={change.actorName ?? "System"}
                  trailing={
                    <time
                      dateTime={change.createdAt}
                      className="text-xs font-normal text-muted-foreground"
                    >
                      {change.date === overview.today
                        ? change.time
                        : `${formatDayLabel(change.date)}, ${change.time}`}
                    </time>
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </DashboardCard>
  );
}

const AVAILABILITY: Record<
  AdminOverview["doctors"][number]["availability"],
  { label: string; tone: PillTone }
> = {
  AVAILABLE: { label: "Available", tone: "done" },
  ON_BREAK: { label: "On break", tone: "wait" },
  OFF_DUTY: { label: "Off duty", tone: "off" },
};

function DoctorsToday({ doctors }: { doctors: AdminOverview["doctors"] }) {
  return (
    <DashboardCard
      title="Doctors"
      bodyClassName="py-0"
      action={
        <Link
          href="/admin/doctors"
          className="text-xs font-semibold text-brand hover:underline"
        >
          Manage
        </Link>
      }
    >
      {doctors.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No doctors yet. Invite one from Staff.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-divider">
          {doctors.map((doctor, index) => {
            const status = AVAILABILITY[doctor.availability];
            return (
              <li key={`${doctor.name}-${index}`}>
                <ListRow
                  leading={
                    <span
                      aria-hidden
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold"
                    >
                      {doctor.name
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("")
                        .toUpperCase()}
                    </span>
                  }
                  title={doctor.name}
                  subtitle={
                    doctor.delayMinutes > 0
                      ? `Running ${doctor.delayMinutes}m late`
                      : undefined
                  }
                  trailing={<Pill tone={status.tone}>{status.label}</Pill>}
                />
              </li>
            );
          })}
        </ul>
      )}
    </DashboardCard>
  );
}

function SetupChecklist({ overview }: { overview: AdminOverview }) {
  const { setup } = overview;
  const staffTotal =
    setup.staffByRole.RECEPTIONIST +
    setup.staffByRole.DOCTOR +
    setup.staffByRole.CLINIC_ADMIN;
  const items: {
    done?: boolean;
    icon?: LucideIcon;
    label: string;
    detail: string;
    href: string;
  }[] = [
    {
      done: setup.hasOpeningHours,
      label: "Opening hours",
      detail: setup.hasOpeningHours
        ? "Set. Queues follow these hours."
        : "Not set, so the clinic shows as always open.",
      href: "/admin/settings#hours",
    },
    {
      done: setup.activeServices > 0,
      label: "Services",
      detail: `${setup.activeServices} active${setup.inactiveServices ? `, ${setup.inactiveServices} turned off` : ""}`,
      href: "/admin/services",
    },
    {
      done: setup.staffByRole.RECEPTIONIST > 0 && setup.staffByRole.DOCTOR > 0,
      label: "Staff",
      detail: `${staffTotal} active: ${setup.staffByRole.RECEPTIONIST} reception, ${setup.staffByRole.DOCTOR} doctors, ${setup.staffByRole.CLINIC_ADMIN} admins${setup.pendingInvitations ? ` · ${setup.pendingInvitations} invited` : ""}`,
      href: "/admin/staff",
    },
    {
      icon: QrCodeIcon,
      label: "QR code",
      detail: "Print the poster for the waiting area.",
      href: "/admin/qr-code",
    },
    {
      icon: CalendarDaysIcon,
      label: "Holidays",
      detail:
        setup.upcomingHolidays.length === 0
          ? "None coming up."
          : setup.upcomingHolidays
              .map(
                (holiday) =>
                  `${formatDayLabel(holiday.date)} (${holiday.name})`,
              )
              .join(", "),
      href: "/admin/settings#holidays",
    },
  ];
  return (
    <DashboardCard title="Clinic setup" bodyClassName="p-3">
      <ul className="grid gap-1 sm:grid-cols-2 xl:grid-cols-5">
        {items.map((item) => {
          const Icon =
            item.icon ?? (item.done ? CircleCheckIcon : CircleDashedIcon);
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                className="flex h-full items-start gap-3 rounded-btn p-3 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Icon
                  aria-hidden
                  className={cn(
                    "mt-0.5 size-5 shrink-0",
                    item.icon
                      ? "text-brand"
                      : item.done
                        ? "text-status-done-foreground"
                        : "text-danger-text",
                  )}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">
                    {item.label}
                    {item.done !== undefined && (
                      <span className="sr-only">
                        {item.done ? " (done)" : " (needs attention)"}
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {item.detail}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </DashboardCard>
  );
}
