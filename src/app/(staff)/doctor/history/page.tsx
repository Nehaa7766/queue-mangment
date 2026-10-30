import { Suspense } from "react";
import { AutoRefresh } from "@/components/layout/auto-refresh";
import { PageHeader } from "@/components/layout/page-header";
import { requireStaffPage } from "@/components/layout/staff-session";
import {
  displayName,
  formatClinicDay,
  formatClinicTime,
} from "@/components/queue/token-display";
import { Skeleton } from "@/components/ui/skeleton";
import type { DoctorHistoryView } from "@/features/doctor/contracts";
import { getDoctorHistory } from "@/features/doctor/queries";
import { DOCTOR_ROLES } from "../doctor-roles";

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

function totalMinutes(view: DoctorHistoryView["days"][number]): number {
  return view.entries.reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);
}

async function History() {
  await requireStaffPage(DOCTOR_ROLES);
  const history = await getDoctorHistory();
  const { timezone } = history;
  const count = history.days.reduce((sum, d) => sum + d.entries.length, 0);

  return (
    <>
      <AutoRefresh seconds={60} />
      <PageHeader
        title="Consultation history"
        search={false}
        status={`Your completed consultations over the last 7 days · ${count} in total`}
      />
      {history.days.length === 0 ? (
        <p className="rounded-card border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          No completed consultations in the last 7 days. They appear here as you
          complete them.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {history.days.map((day) => (
            <section
              key={day.date}
              aria-labelledby={`day-${day.date}`}
              className="flex flex-col gap-2"
            >
              <h2
                id={`day-${day.date}`}
                className="flex flex-wrap items-baseline gap-x-2 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase"
              >
                {dayLabel(day.date, timezone)}
                <span className="tracking-normal normal-case tabular-nums">
                  {day.entries.length}{" "}
                  {day.entries.length === 1 ? "patient" : "patients"} ·{" "}
                  {totalMinutes(day)} min
                </span>
              </h2>
              <ul className="flex flex-col divide-y divide-divider rounded-card border border-border bg-card px-4">
                {day.entries.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5"
                  >
                    <span className="w-14 font-display font-extrabold tabular-nums">
                      {entry.tokenLabel}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {displayName(entry.patientName)}
                      <span className="text-muted-foreground">
                        {" "}
                        · {entry.serviceName}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {entry.serviceStartedAt &&
                        formatClinicTime(entry.serviceStartedAt, timezone)}
                      {entry.completedAt &&
                        `–${formatClinicTime(entry.completedAt, timezone)}`}
                      {entry.durationMinutes !== null &&
                        ` · ${entry.durationMinutes} min`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function HistorySkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <Skeleton className="h-8 w-56" />
      {Array.from({ length: 2 }, (_, i) => (
        <Skeleton key={i} className="h-48 rounded-card" />
      ))}
      <span className="sr-only">Loading your consultation history…</span>
    </div>
  );
}
