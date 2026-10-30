"use client";

import {
  BellRingIcon,
  ClockIcon,
  UserCheckIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import {
  DashboardCard,
  StatStrip,
} from "@/components/dashboard/dashboard-card";
import { HighlightCard } from "@/components/dashboard/highlight-card";
import { ListRow, TokenBadge } from "@/components/dashboard/list-row";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  displayName,
  formatClinicTime,
  formatClock,
} from "@/components/queue/token-display";
import { useNow } from "@/components/queue/use-now";
import { buttonVariants } from "@/components/ui/button";
import type { DoctorPanelView } from "@/features/doctor/contracts";
import { cn } from "@/lib/utils";
import { AvailabilityQuickToggle } from "./availability-quick-toggle";
import { CalledPatientList } from "./called-patient-list";
import { CompleteButton } from "./complete-button";
import { ConsultationTicket } from "./consultation-ticket";
import { startBlockedReason } from "./doctor-panel-state";
import {
  completionsPerHour,
  consultationMinutes,
  durationMinutes,
  waitedMinutes,
} from "./patient-display";
import { PatientTable } from "./patient-table";
import { inServiceWithCurrent, PatientTabs } from "./patient-tabs";
import { SyncStatus } from "./sync-status";
import { useDoctorPanel, type DoctorPanel } from "./use-doctor-panel";

const LINK = cn(
  buttonVariants({ variant: "ghost", size: "sm" }),
  "h-8 rounded-btn px-2.5 text-brand hover:text-brand",
);

function servicesNote(view: DoctorPanelView): string {
  return view.assignedOnly
    ? "Everyone in the services assigned to you"
    : "Everyone in every service. Your clinic admin can assign you to specific ones.";
}

function Sync({ panel, now }: { panel: DoctorPanel; now: number }) {
  return (
    <SyncStatus
      lastSynced={panel.lastSynced}
      now={now}
      refreshFailed={panel.refreshFailed}
    />
  );
}

// The doctor's current consultation with Complete, or nothing.
function CurrentConsultation({
  panel,
  now,
}: {
  panel: DoctorPanel;
  now: number;
}) {
  const { view, pending, run } = panel;
  if (!view.current) return null;
  const token = view.current;
  return (
    <ConsultationTicket
      token={token}
      now={now}
      timezone={view.clinic.timezone}
      actions={
        <CompleteButton
          token={token}
          pending={pending?.type === "complete"}
          disabled={pending !== null}
          onComplete={() => void run({ type: "complete", tokenId: token.id })}
        />
      }
    />
  );
}

// Brand highlight card on the dashboard: the consultation in progress with Complete,
// or, when the doctor is free, who reception has called.
function ConsultationHighlight({
  panel,
  now,
}: {
  panel: DoctorPanel;
  now: number;
}) {
  const { view, pending, run } = panel;
  const series = completionsPerHour(view.completedToday, now);
  const footer = {
    href: "/doctor/consultation",
    label: "Open consultation screen",
  };
  const token = view.current;

  if (token) {
    const minutes = consultationMinutes(token, now);
    const started = token.serviceStartedAt
      ? ` · started ${formatClinicTime(token.serviceStartedAt, view.clinic.timezone)}`
      : "";
    return (
      <HighlightCard
        value={token.tokenLabel}
        label="In consultation"
        badge={minutes === null ? undefined : `${minutes} min`}
        series={series}
        footer={footer}
      >
        <ListRow
          title={displayName(token.patientName)}
          subtitle={`${token.serviceName}${started}`}
        />
        <div className="py-4">
          <CompleteButton
            token={token}
            pending={pending?.type === "complete"}
            disabled={pending !== null}
            onComplete={() => void run({ type: "complete", tokenId: token.id })}
            className="w-full sm:w-full"
          />
        </div>
      </HighlightCard>
    );
  }

  return (
    <HighlightCard
      value="Ready"
      label="For the next patient"
      badge={`${view.called.length} called`}
      series={series}
      footer={footer}
    >
      {view.called.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          Reception calls patients. They appear here, ready to start.
        </p>
      ) : (
        view.called.map((called) => (
          <ListRow
            key={called.id}
            leading={<TokenBadge label={called.tokenLabel} />}
            title={displayName(called.patientName)}
            subtitle={called.serviceName}
            trailing={
              called.calledAt
                ? formatClock((now - Date.parse(called.calledAt)) / 1000)
                : undefined
            }
            trailingSub={called.calledAt ? "since called" : undefined}
          />
        ))
      )}
    </HighlightCard>
  );
}

// /doctor: today's numbers, the complete patient list in tabs, the
// consultation in progress and the availability toggle (docs/PLAN.md §12.8).
export function DoctorDashboard({
  initialView,
}: {
  initialView: DoctorPanelView;
}) {
  const panel = useDoctorPanel(initialView);
  const now = useNow(Date.parse(initialView.generatedAt));
  const { view } = panel;

  const overTarget = view.waiting.filter(
    (token) => waitedMinutes(token, now) > view.waitTargetMinutes,
  ).length;
  const inConsultation = inServiceWithCurrent(view).length;
  const today =
    view.seenToday + inConsultation + view.called.length + view.waitingCount;
  const seenShare = today > 0 ? Math.round((view.seenToday / today) * 100) : 0;
  const longestCalled = view.called[0]?.calledAt;
  const minutesWithPatients = view.completedToday.reduce(
    (sum, token) => sum + (durationMinutes(token) ?? 0),
    0,
  );

  return (
    <div className="flex flex-col gap-5">
      <section
        aria-label="Today at a glance"
        className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          icon={UsersIcon}
          value={view.waitingCount}
          label="Waiting for you"
          footerLabel={`Over the ${view.waitTargetMinutes} min target`}
          footerValue={overTarget}
          progress={
            view.waitingCount > 0 ? (overTarget / view.waitingCount) * 100 : 0
          }
          tone="amber"
        />
        <StatCard
          icon={BellRingIcon}
          value={view.called.length}
          label="Called, ready to start"
          footerLabel="Longest since called"
          footerValue={
            longestCalled
              ? formatClock((now - Date.parse(longestCalled)) / 1000)
              : "—"
          }
          progress={
            view.called.length + view.waitingCount > 0
              ? (view.called.length /
                  (view.called.length + view.waitingCount)) *
                100
              : 0
          }
        />
        <StatCard
          icon={UserCheckIcon}
          value={view.seenToday}
          label="Seen today"
          footerLabel="Of today's patients"
          footerValue={`${seenShare}%`}
          progress={seenShare}
          tone="green"
        />
        <StatCard
          icon={ClockIcon}
          value={
            view.averageConsultationMinutes === null
              ? "—"
              : `${view.averageConsultationMinutes} min`
          }
          label="Average consultation"
          footerLabel="Time with patients today"
          footerValue={`${minutesWithPatients} min`}
        />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <DashboardCard
          title="Patients"
          description={servicesNote(view)}
          action={
            <Link href="/doctor/queue" className={LINK}>
              Open my queue
            </Link>
          }
          bodyClassName="p-0"
        >
          <PatientTabs panel={panel} now={now} />
        </DashboardCard>
        <div className="flex min-w-0 flex-col gap-5">
          <ConsultationHighlight panel={panel} now={now} />
          <AvailabilityQuickToggle
            doctor={view.doctor}
            onChange={panel.setDoctor}
          />
        </div>
      </div>

      <Sync panel={panel} now={now} />
    </div>
  );
}

// /doctor/queue: every patient in the doctor's services in one table.
export function DoctorQueueBoard({
  initialView,
}: {
  initialView: DoctorPanelView;
}) {
  const panel = useDoctorPanel(initialView);
  const now = useNow(Date.parse(initialView.generatedAt));
  const { view } = panel;

  return (
    <div className="flex flex-col gap-5">
      <DashboardCard
        title="Patients"
        description={`${servicesNote(view)} Reception calls patients; start them when they reach you.`}
        bodyClassName="p-0"
        footer={
          <StatStrip
            stats={[
              { label: "Waiting", value: view.waitingCount, tone: "amber" },
              { label: "Called", value: view.called.length, tone: "brand" },
              {
                label: "In consultation",
                value: inServiceWithCurrent(view).length,
                tone: "tan",
              },
              {
                label: "Done today",
                value: view.completedToday.length,
                tone: "green",
              },
            ]}
          />
        }
      >
        <PatientTable panel={panel} now={now} />
      </DashboardCard>
      <Sync panel={panel} now={now} />
    </div>
  );
}

// /doctor/consultation: the consultation in progress, large, with Complete;
// otherwise the called patients ready to start.
export function DoctorConsultation({
  initialView,
}: {
  initialView: DoctorPanelView;
}) {
  const panel = useDoctorPanel(initialView);
  const now = useNow(Date.parse(initialView.generatedAt));
  const { view, pending, run } = panel;

  return (
    <div className="flex flex-col gap-5">
      {view.current ? (
        <CurrentConsultation panel={panel} now={now} />
      ) : (
        <p
          role="status"
          className="rounded-card border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground"
        >
          No consultation in progress. Start a called patient below.
        </p>
      )}
      <DashboardCard
        title="Ready to start"
        description={
          view.called.length === 1
            ? "1 patient called by reception"
            : `${view.called.length} patients called by reception`
        }
        bodyClassName="p-0"
        footer={
          <p className="border-t border-divider px-5 py-3.5 text-sm text-muted-foreground tabular-nums">
            {view.waitingCount === 1
              ? "1 patient waiting"
              : `${view.waitingCount} patients waiting`}{" "}
            {view.assignedOnly ? "in your services" : "across the clinic"}.{" "}
            <Link
              href="/doctor/queue"
              className="font-medium text-brand underline-offset-4 hover:underline"
            >
              See the queue
            </Link>
          </p>
        }
      >
        <CalledPatientList
          tokens={view.called}
          now={now}
          blockedReason={startBlockedReason(view, pending !== null)}
          pendingTokenId={pending?.type === "start" ? pending.tokenId : null}
          onStart={(token) => void run({ type: "start", tokenId: token.id })}
        />
      </DashboardCard>
      <Sync panel={panel} now={now} />
    </div>
  );
}
