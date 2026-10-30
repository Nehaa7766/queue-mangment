"use client";

import { ClockIcon, UserCheckIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { KpiCard } from "@/components/queue/kpi-card";
import { useNow } from "@/components/queue/use-now";
import { buttonVariants } from "@/components/ui/button";
import type { DoctorPanelView } from "@/features/doctor/contracts";
import { cn } from "@/lib/utils";
import { AvailabilityQuickToggle } from "./availability-quick-toggle";
import { CalledPatientList } from "./called-patient-list";
import { CompleteButton } from "./complete-button";
import { ConsultationTicket } from "./consultation-ticket";
import { startBlockedReason } from "./doctor-panel-state";
import { ServiceQueueList } from "./service-queue-list";
import { SyncStatus } from "./sync-status";
import { useDoctorPanel } from "./use-doctor-panel";

type Panel = ReturnType<typeof useDoctorPanel>;

const SECTION_LABEL =
  "text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase";

// The doctor's current consultation with Complete, or nothing.
function CurrentConsultation({ panel, now }: { panel: Panel; now: number }) {
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

function ReadyList({ panel, now }: { panel: Panel; now: number }) {
  const { view, pending, run } = panel;
  return (
    <CalledPatientList
      tokens={view.called}
      now={now}
      blockedReason={startBlockedReason(view, pending !== null)}
      pendingTokenId={pending?.type === "start" ? pending.tokenId : null}
      onStart={(token) => void run({ type: "start", tokenId: token.id })}
    />
  );
}

function servicesCaption(view: DoctorPanelView): string {
  return view.assignedOnly ? "In your services" : "Across all services";
}

// /doctor: current patient, who's ready, a preview of each queue and the
// availability toggle (docs/PLAN.md §12.8).
export function DoctorDashboard({
  initialView,
}: {
  initialView: DoctorPanelView;
}) {
  const panel = useDoctorPanel(initialView);
  const now = useNow(Date.parse(initialView.generatedAt));
  const { view } = panel;

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-label="Today at a glance"
        className="grid grid-cols-2 gap-3.5 lg:grid-cols-3"
      >
        <KpiCard
          label="Seen today"
          value={view.seenToday}
          icon={UserCheckIcon}
          caption="Consultations completed"
        />
        <KpiCard
          label="Waiting"
          value={view.waitingCount}
          icon={UsersIcon}
          caption={servicesCaption(view)}
        />
        <div className="col-span-2 lg:col-span-1">
          <KpiCard
            label="Average consultation"
            value={
              view.averageConsultationMinutes === null
                ? "—"
                : `${view.averageConsultationMinutes}m`
            }
            icon={ClockIcon}
            caption="Today"
          />
        </div>
      </section>

      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-3.5">
          <CurrentConsultation panel={panel} now={now} />
          <ReadyList panel={panel} now={now} />
        </div>
        <div className="flex min-w-0 flex-col gap-3.5">
          <AvailabilityQuickToggle
            doctor={view.doctor}
            onChange={panel.setDoctor}
          />
          <section aria-labelledby="up-next" className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h2 id="up-next" className={SECTION_LABEL}>
                Up next
              </h2>
              <Link
                href="/doctor/queue"
                className="text-sm font-medium text-slate underline-offset-4 hover:underline"
              >
                Full queue
              </Link>
            </div>
            <ServiceQueueList
              services={view.services}
              waiting={view.waiting}
              now={now}
              waitTargetMinutes={view.waitTargetMinutes}
              limit={3}
            />
          </section>
        </div>
      </div>

      <SyncStatus
        lastSynced={panel.lastSynced}
        now={now}
        refreshFailed={panel.refreshFailed}
      />
    </div>
  );
}

// /doctor/queue: everyone called and waiting in the doctor's services.
export function DoctorQueueBoard({
  initialView,
}: {
  initialView: DoctorPanelView;
}) {
  const panel = useDoctorPanel(initialView);
  const now = useNow(Date.parse(initialView.generatedAt));
  const { view } = panel;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {view.assignedOnly
          ? "Showing the services assigned to you."
          : "Showing every service. Your clinic admin can assign you to specific services."}{" "}
        Reception calls patients; start them when they reach you.
      </p>
      <CurrentConsultation panel={panel} now={now} />
      <ReadyList panel={panel} now={now} />
      <section aria-labelledby="waiting-title" className="flex flex-col gap-2">
        <h2 id="waiting-title" className={SECTION_LABEL}>
          Waiting · {view.waitingCount}
        </h2>
        <ServiceQueueList
          services={view.services}
          waiting={view.waiting}
          now={now}
          waitTargetMinutes={view.waitTargetMinutes}
        />
      </section>
      <SyncStatus
        lastSynced={panel.lastSynced}
        now={now}
        refreshFailed={panel.refreshFailed}
      />
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
  const { view } = panel;

  return (
    <div className="flex flex-col gap-4">
      {view.current ? (
        <CurrentConsultation panel={panel} now={now} />
      ) : (
        <p
          role="status"
          className="rounded-card border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          No consultation in progress. Start a called patient below.
        </p>
      )}
      <ReadyList panel={panel} now={now} />
      <p className="text-sm text-muted-foreground tabular-nums">
        {view.waitingCount === 1
          ? "1 patient waiting"
          : `${view.waitingCount} patients waiting`}{" "}
        {view.assignedOnly ? "in your services" : "across the clinic"}.{" "}
        <Link
          href="/doctor/queue"
          className={cn(
            buttonVariants({ variant: "link" }),
            "h-auto p-0 text-slate",
          )}
        >
          See the queue
        </Link>
      </p>
      <SyncStatus
        lastSynced={panel.lastSynced}
        now={now}
        refreshFailed={panel.refreshFailed}
      />
    </div>
  );
}
