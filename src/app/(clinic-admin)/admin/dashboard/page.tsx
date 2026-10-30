import {
  CalendarDaysIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  ClockIcon,
  QrCodeIcon,
  UserCheckIcon,
  UsersIcon,
  UserXIcon,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { AdminSection, Pill, type PillTone } from "@/components/admin/admin-ui";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { requireStaffPage } from "@/components/layout/staff-session";
import { KpiCard } from "@/components/queue/kpi-card";
import { buttonVariants } from "@/components/ui/button";
import {
  getAdminOverview,
  type AdminOverview,
} from "@/features/analytics/admin-queries";
import { formatDayLabel } from "@/features/analytics/range-time";
import { getDashboardView } from "@/features/analytics/queries";
import { cn } from "@/lib/utils";

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton label="Loading the dashboard…" />}>
      <AdminDashboard />
    </Suspense>
  );
}

async function AdminDashboard() {
  const context = await requireStaffPage(["CLINIC_ADMIN"]);
  const [overview, today] = await Promise.all([
    getAdminOverview(context.clinic.id),
    getDashboardView(context.clinic.id),
  ]);

  return (
    <>
      <PageHeader
        title="Admin dashboard"
        status={`${overview.clinic.name} · ${formatDayLabel(overview.today)}`}
      />

      <section
        aria-label="Today at a glance"
        className="grid grid-cols-2 gap-3.5 lg:grid-cols-4"
      >
        <KpiCard
          label="Waiting now"
          value={today.kpis.waitingNow}
          icon={UsersIcon}
        />
        <KpiCard
          label="Served today"
          value={today.kpis.servedToday}
          icon={UserCheckIcon}
        />
        <KpiCard
          label="Average wait"
          value={
            today.kpis.averageWaitMinutes === null
              ? "—"
              : `${today.kpis.averageWaitMinutes}m`
          }
          icon={ClockIcon}
          caption={`Target ${today.waitTargetMinutes}m`}
        />
        <KpiCard
          label="No-shows"
          value={today.kpis.noShowsToday}
          icon={UserXIcon}
        />
      </section>

      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-2">
        <SetupChecklist overview={overview} />
        <DoctorsToday doctors={overview.doctors} />
      </div>

      <AdminSection
        title="Recent changes"
        description="Services, staff and settings. Queue activity is on the reception dashboard."
        className="mt-3.5"
        actions={
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
          <p className="py-4 text-center text-sm text-muted-foreground">
            No changes yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-divider">
            {overview.recentChanges.map((change) => (
              <li
                key={change.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{change.label}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {change.actorName ?? "System"}
                  </p>
                </div>
                <time
                  dateTime={change.createdAt}
                  className="shrink-0 text-xs text-muted-foreground tabular-nums"
                >
                  {change.date === overview.today
                    ? change.time
                    : `${formatDayLabel(change.date)}, ${change.time}`}
                </time>
              </li>
            ))}
          </ul>
        )}
      </AdminSection>
    </>
  );
}

function SetupChecklist({ overview }: { overview: AdminOverview }) {
  const { setup } = overview;
  const staffTotal =
    setup.staffByRole.RECEPTIONIST +
    setup.staffByRole.DOCTOR +
    setup.staffByRole.CLINIC_ADMIN;
  const items = [
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
  ];
  return (
    <AdminSection title="Clinic setup">
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              className="flex items-start gap-3 rounded-btn px-2 py-2.5 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {item.done ? (
                <CircleCheckIcon
                  aria-hidden
                  className="mt-0.5 size-5 shrink-0 text-status-done-foreground"
                />
              ) : (
                <CircleDashedIcon
                  aria-hidden
                  className="mt-0.5 size-5 shrink-0 text-terracotta-text"
                />
              )}
              <span className="min-w-0">
                <span className="block text-sm font-semibold">
                  {item.label}
                  <span className="sr-only">
                    {item.done ? " (done)" : " (needs attention)"}
                  </span>
                </span>
                <span className="block text-xs text-muted-foreground">
                  {item.detail}
                </span>
              </span>
            </Link>
          </li>
        ))}
        <li>
          <Link
            href="/admin/qr-code"
            className="flex items-start gap-3 rounded-btn px-2 py-2.5 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <QrCodeIcon
              aria-hidden
              className="mt-0.5 size-5 shrink-0 text-slate"
            />
            <span>
              <span className="block text-sm font-semibold">QR code</span>
              <span className="block text-xs text-muted-foreground">
                Print the poster for the waiting area.
              </span>
            </span>
          </Link>
        </li>
        <li>
          <Link
            href="/admin/settings#holidays"
            className="flex items-start gap-3 rounded-btn px-2 py-2.5 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <CalendarDaysIcon
              aria-hidden
              className="mt-0.5 size-5 shrink-0 text-slate"
            />
            <span>
              <span className="block text-sm font-semibold">Holidays</span>
              <span className="block text-xs text-muted-foreground">
                {setup.upcomingHolidays.length === 0
                  ? "None coming up."
                  : setup.upcomingHolidays
                      .map(
                        (holiday) =>
                          `${formatDayLabel(holiday.date)} (${holiday.name})`,
                      )
                      .join(", ")}
              </span>
            </span>
          </Link>
        </li>
      </ul>
    </AdminSection>
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
    <AdminSection
      title="Doctors"
      actions={
        <Link
          href="/admin/doctors"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-9 rounded-btn",
          )}
        >
          Manage
        </Link>
      }
    >
      {doctors.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No doctors yet. Invite one from Staff.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-divider">
          {doctors.map((doctor, index) => {
            const status = AVAILABILITY[doctor.availability];
            return (
              <li
                key={`${doctor.name}-${index}`}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <span className="text-sm font-semibold">{doctor.name}</span>
                <span className="flex items-center gap-2">
                  {doctor.delayMinutes > 0 && (
                    <span className="text-xs text-terracotta-text">
                      Running {doctor.delayMinutes}m late
                    </span>
                  )}
                  <Pill tone={status.tone}>{status.label}</Pill>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </AdminSection>
  );
}
