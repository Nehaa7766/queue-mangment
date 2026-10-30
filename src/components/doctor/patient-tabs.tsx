"use client";

import { useState } from "react";
import { SegmentTabs } from "@/components/dashboard/segment-tabs";
import { CalledPatientList } from "./called-patient-list";
import { startBlockedReason } from "./doctor-panel-state";
import {
  DoneTodayList,
  InServiceList,
  WaitingByService,
} from "./patient-lists";
import type { DoctorPanel } from "./use-doctor-panel";

type PatientTab = "inService" | "called" | "waiting" | "done";

// Today's in-consultation patients, plus one left open from an earlier day,
// so the doctor can always find it.
export function inServiceWithCurrent(view: DoctorPanel["view"]) {
  const { current, inService } = view;
  return current && !inService.some((token) => token.id === current.id)
    ? [current, ...inService]
    : inService;
}

// The dashboard's complete patient list: every patient in the doctor's
// services, in four tabs, with no row limits.
export function PatientTabs({
  panel,
  now,
}: {
  panel: DoctorPanel;
  now: number;
}) {
  const { view, pending, run } = panel;
  const inService = inServiceWithCurrent(view);
  const [tab, setTab] = useState<PatientTab>(() =>
    view.current ? "inService" : view.called.length > 0 ? "called" : "waiting",
  );

  return (
    <SegmentTabs
      label="Patients"
      idBase="doctor-patients"
      value={tab}
      onChange={setTab}
      tabs={[
        { key: "inService", label: "In consultation", count: inService.length },
        { key: "called", label: "Called", count: view.called.length },
        { key: "waiting", label: "Waiting", count: view.waitingCount },
        { key: "done", label: "Done today", count: view.completedToday.length },
      ]}
    >
      {tab === "inService" && (
        <InServiceList
          tokens={inService}
          currentId={view.current?.id ?? null}
          now={now}
          timezone={view.clinic.timezone}
        />
      )}
      {tab === "called" && (
        <CalledPatientList
          tokens={view.called}
          now={now}
          blockedReason={startBlockedReason(view, pending !== null)}
          pendingTokenId={pending?.type === "start" ? pending.tokenId : null}
          onStart={(token) => void run({ type: "start", tokenId: token.id })}
        />
      )}
      {tab === "waiting" && (
        <WaitingByService
          services={view.services}
          waiting={view.waiting}
          now={now}
          timezone={view.clinic.timezone}
          waitTargetMinutes={view.waitTargetMinutes}
        />
      )}
      {tab === "done" && (
        <DoneTodayList
          tokens={view.completedToday}
          timezone={view.clinic.timezone}
        />
      )}
    </SegmentTabs>
  );
}
