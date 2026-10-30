import { CalendarCheckIcon, ClockIcon, UserCheckIcon } from "lucide-react";
import { Suspense } from "react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { TokenBadge } from "@/components/dashboard/list-row";
import { StatCard } from "@/components/dashboard/stat-card";
import { AutoRefresh } from "@/components/layout/auto-refresh";
import { PageHeader } from "@/components/layout/page-header";
import { requireStaffPage } from "@/components/layout/staff-session";
import {
  displayName,
  formatClinicDay,
  formatClinicTime,
} from "@/components/queue/token-display";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  DoctorHistoryEntry,
  DoctorHistoryView,
} from "@/features/doctor/contracts";
import { getDoctorHistory } from "@/features/doctor/queries";
import { DOCTOR_ROLES } from "../doctor-roles";

const HISTORY_DAYS = 7;
const TH =
  "px-5 py-3 text-left text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase";

export default function DoctorHistoryPage() {
  return (
    <Suspense fallback={<HistorySkeleton />}>
      <History />
    </Suspense>
  );
}

// Noon UTC on the queue date, so the weekday label never shifts across a
// timezone boundary.
function dayLabel(date: string, timezone: string): string {
  return formatClinicDay(`${date}T12:00:00Z`, timezone);
}

function totalMinutes(entries: readonly DoctorHistoryEntry[]): number {
  return entries.reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);
}

function patients(count: number): string {
  return count === 1 ? "1 patient" : `${count} patients`;
}

async function History() {
  await requireStaffPage(DOCTOR_ROLES);
  const history = await getDoctorHistory();
  const { timezone } = history;
  const entries = history.days.flatMap((day) => day.entries);
  const timed = entries.filter((e) => e.durationMinutes !== null);
  const average =
    timed.length > 0 ? Math.round(totalMinutes(timed) / timed.length) : null;
  const busiest = history.days.reduce<DoctorHistoryView["days"][number] | null>(
    (best, day) =>
      !best || day.entries.length > best.entries.length ? day : best,
    null,
  );

  return (
    <>
      <AutoRefresh seconds={60} />
      <PageHeader
        title="Consultation history"
        breadcrumbs={[
          { label: "Doctor", href: "/doctor" },
          { label: "History" },
        ]}
        status={`Your completed consultations over the last ${HISTORY_DAYS} days`}
      />

      <section
        aria-label="This week at a glance"
        className="mb-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
      >
        <StatCard
          icon={UserCheckIcon}
          value={entries.length}
          label="Patients this week"
          footerLabel="Days with consultations"
          footerValue={`${history.days.length} of ${HISTORY_DAYS}`}
          progress={(history.days.length / HISTORY_DAYS) * 100}
          tone="green"
        />
        <StatCard
          icon={ClockIcon}
          value={average === null ? "—" : `${average} min`}
          label="Average consultation"
          footerLabel="Time with patients"
          footerValue={`${totalMinutes(entries)} min`}
        />
        <StatCard
          icon={CalendarCheckIcon}
          value={busiest ? busiest.entries.length : "—"}
          label="Busiest day"
          footerLabel={
            busiest ? dayLabel(busiest.date, timezone) : "No days yet"
          }
          footerValue={busiest ? patients(busiest.entries.length) : undefined}
          tone="rose"
          className="sm:col-span-2 xl:col-span-1"
        />
      </section>

      {history.days.length === 0 ? (
        <p className="rounded-card border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          No completed consultations in the last {HISTORY_DAYS} days. They
          appear here as you complete them.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {history.days.map((day) => (
            <DashboardCard
              key={day.date}
              title={dayLabel(day.date, timezone)}
              description={`${patients(day.entries.length)} · ${totalMinutes(day.entries)} min with patients`}
              bodyClassName="p-0"
            >
              <HistoryTable entries={day.entries} timezone={timezone} />
            </DashboardCard>
          ))}
        </div>
      )}
    </>
  );
}

// One day's consultations. On phones each row becomes a small card.
function HistoryTable({
  entries,
  timezone,
}: {
  entries: readonly DoctorHistoryEntry[];
  timezone: string;
}) {
  // Wide tables scroll inside the card instead of being cut off.
  return (
    <div className="overflow-x-auto">
      <table role="table" className="w-full text-sm max-md:block">
        <thead className="max-md:hidden">
          <tr className="border-b border-divider">
            <th scope="col" className={TH}>
              Token
            </th>
            <th scope="col" className={TH}>
              Patient
            </th>
            <th scope="col" className={TH}>
              Service
            </th>
            <th scope="col" className={TH}>
              Started
            </th>
            <th scope="col" className={TH}>
              Finished
            </th>
            <th scope="col" className={`${TH} text-right`}>
              Duration
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup" className="divide-y divide-divider max-md:block">
          {entries.map((entry) => (
            <tr
              key={entry.id}
              role="row"
              className="max-md:grid max-md:grid-cols-[auto_minmax(0,1fr)_auto] max-md:items-center max-md:gap-x-3 max-md:gap-y-0.5 max-md:px-4 max-md:py-3"
            >
              <td
                role="cell"
                className="px-5 py-3 max-md:col-start-1 max-md:row-span-2 max-md:row-start-1 max-md:p-0"
              >
                <TokenBadge label={entry.tokenLabel} tone="muted" />
              </td>
              <td
                role="cell"
                className="px-5 py-3 font-semibold max-md:col-start-2 max-md:row-start-1 max-md:truncate max-md:p-0"
              >
                {displayName(entry.patientName)}
              </td>
              <td
                role="cell"
                className="px-5 py-3 text-muted-foreground max-md:col-start-2 max-md:row-start-2 max-md:truncate max-md:p-0 max-md:text-xs"
              >
                {entry.serviceName}
              </td>
              <td role="cell" className="px-5 py-3 tabular-nums max-md:hidden">
                {entry.serviceStartedAt
                  ? formatClinicTime(entry.serviceStartedAt, timezone)
                  : "—"}
              </td>
              <td
                role="cell"
                className="px-5 py-3 tabular-nums max-md:col-start-3 max-md:row-start-2 max-md:p-0 max-md:text-right max-md:text-xs max-md:text-muted-foreground"
              >
                {entry.completedAt ? (
                  <>
                    <span className="md:hidden">
                      {entry.serviceStartedAt
                        ? `${formatClinicTime(entry.serviceStartedAt, timezone)}–`
                        : ""}
                    </span>
                    {formatClinicTime(entry.completedAt, timezone)}
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td
                role="cell"
                className="px-5 py-3 text-right font-medium tabular-nums max-md:col-start-3 max-md:row-start-1 max-md:p-0"
              >
                {entry.durationMinutes === null
                  ? "—"
                  : `${entry.durationMinutes} min`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-5">
      <Skeleton className="-mx-4 -mt-4 h-16 rounded-none md:-mx-6 md:-mt-6" />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-[132px] rounded-card" />
        ))}
      </div>
      {Array.from({ length: 2 }, (_, i) => (
        <Skeleton key={i} className="h-56 rounded-card" />
      ))}
      <span className="sr-only">Loading your consultation history…</span>
    </div>
  );
}
