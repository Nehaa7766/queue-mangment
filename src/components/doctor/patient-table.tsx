"use client";

import { useState, type ReactNode } from "react";
import { TokenBadge } from "@/components/dashboard/list-row";
import { SegmentTabs } from "@/components/dashboard/segment-tabs";
import { TokenStatusPill } from "@/components/queue/status-pill";
import {
  displayName,
  formatClinicTime,
  formatClock,
} from "@/components/queue/token-display";
import type { StaffTokenView } from "@/features/queue/contracts";
import { cn } from "@/lib/utils";
import { StartButton } from "./called-patient-list";
import { CompleteButton } from "./complete-button";
import { startBlockedReason } from "./doctor-panel-state";
import {
  consultationMinutes,
  durationMinutes,
  timeRange,
  waitedMinutes,
} from "./patient-display";
import { inServiceWithCurrent } from "./patient-tabs";
import type { DoctorPanel } from "./use-doctor-panel";

type Kind = "inService" | "called" | "waiting" | "done";
type Filter = "all" | Kind;
type Row = { token: StaffTokenView; kind: Kind };

// Header cells; hidden on phones, where each row becomes a small card.
const TH =
  "px-5 py-3 text-left text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase";

// Wait or consultation time for a row, in words.
function TimeCell({
  row,
  now,
  timezone,
  waitTargetMinutes,
}: {
  row: Row;
  now: number;
  timezone: string;
  waitTargetMinutes: number;
}) {
  const { token, kind } = row;
  let main: ReactNode = null;
  let sub: string | null = null;
  if (kind === "waiting") {
    const waited = waitedMinutes(token, now);
    const over = waited > waitTargetMinutes;
    main = (
      <span className={cn(over && "text-danger-text")}>
        {waited} min {over ? "· over target" : "waited"}
      </span>
    );
    sub = `Joined ${formatClinicTime(token.joinedAt, timezone)}`;
  } else if (kind === "called") {
    main = token.calledAt
      ? `Called ${formatClock((now - Date.parse(token.calledAt)) / 1000)} ago`
      : "Called";
    sub = `Joined ${formatClinicTime(token.joinedAt, timezone)}`;
  } else if (kind === "inService") {
    const minutes = consultationMinutes(token, now);
    main = minutes === null ? "In consultation" : `${minutes} min so far`;
    sub = token.serviceStartedAt
      ? `Started ${formatClinicTime(token.serviceStartedAt, timezone)}`
      : null;
  } else {
    const minutes = durationMinutes(token);
    main = minutes === null ? "Done" : `${minutes} min`;
    sub = timeRange(token, timezone) || null;
  }
  return (
    <span className="flex flex-col tabular-nums max-md:items-end">
      <span className="font-medium">{main}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </span>
  );
}

// /doctor/queue: every patient in the doctor's services in one table, with
// filter tabs. Start for called patients, Complete for the doctor's own.
export function PatientTable({
  panel,
  now,
}: {
  panel: DoctorPanel;
  now: number;
}) {
  const { view, pending, run } = panel;
  const [filter, setFilter] = useState<Filter>("all");
  const blockedReason = startBlockedReason(view, pending !== null);

  const groups: Record<Kind, StaffTokenView[]> = {
    inService: inServiceWithCurrent(view),
    called: view.called,
    waiting: view.waiting,
    done: view.completedToday,
  };
  const order: Kind[] = ["inService", "called", "waiting", "done"];
  const rows: Row[] = order
    .filter((kind) => filter === "all" || filter === kind)
    .flatMap((kind) => groups[kind].map((token) => ({ token, kind })));
  const counts = {
    inService: groups.inService.length,
    called: groups.called.length,
    waiting: groups.waiting.length,
    done: groups.done.length,
  };

  function action(row: Row): ReactNode {
    if (row.kind === "called") {
      return (
        <StartButton
          token={row.token}
          blockedReason={blockedReason}
          pending={
            pending?.type === "start" && pending.tokenId === row.token.id
          }
          onStart={() => void run({ type: "start", tokenId: row.token.id })}
        />
      );
    }
    if (row.kind === "inService" && row.token.id === view.current?.id) {
      return (
        <CompleteButton
          token={row.token}
          pending={pending?.type === "complete"}
          disabled={pending !== null}
          onComplete={() =>
            void run({ type: "complete", tokenId: row.token.id })
          }
          className="h-10 px-4 text-sm"
        />
      );
    }
    return null;
  }

  return (
    <SegmentTabs
      label="Filter patients"
      idBase="doctor-queue"
      value={filter}
      onChange={setFilter}
      tabs={[
        { key: "all", label: "All", count: sum(counts) },
        { key: "waiting", label: "Waiting", count: counts.waiting },
        { key: "called", label: "Called", count: counts.called },
        { key: "inService", label: "In consultation", count: counts.inService },
        { key: "done", label: "Done today", count: counts.done },
      ]}
    >
      {/* Wide tables scroll inside the card instead of being cut off. */}
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
                Status
              </th>
              <th scope="col" className={TH}>
                Time
              </th>
              <th scope="col" className={cn(TH, "text-right")}>
                Action
              </th>
            </tr>
          </thead>
          <tbody
            role="rowgroup"
            className="divide-y divide-divider max-md:block"
          >
            {rows.length === 0 ? (
              <tr role="row" className="max-md:block">
                <td
                  role="cell"
                  colSpan={6}
                  className="px-5 py-10 text-center text-muted-foreground max-md:block"
                >
                  No patients here right now.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const { token } = row;
                const button = action(row);
                const others =
                  row.kind === "inService" &&
                  token.id !== view.current?.id &&
                  token.assignedDoctorName;
                return (
                  <tr
                    key={token.id}
                    role="row"
                    className="max-md:grid max-md:grid-cols-[auto_minmax(0,1fr)_auto] max-md:items-center max-md:gap-x-3 max-md:gap-y-1 max-md:px-4 max-md:py-3.5"
                  >
                    <td
                      role="cell"
                      className="px-5 py-3 max-md:col-start-1 max-md:row-span-2 max-md:row-start-1 max-md:p-0"
                    >
                      <TokenBadge
                        label={token.tokenLabel}
                        tone={
                          row.kind === "inService" || row.kind === "called"
                            ? "brand"
                            : "muted"
                        }
                      />
                    </td>
                    <td
                      role="cell"
                      className="px-5 py-3 font-semibold max-md:col-start-2 max-md:row-start-1 max-md:truncate max-md:p-0"
                    >
                      {displayName(token.patientName)}
                    </td>
                    <td
                      role="cell"
                      className="px-5 py-3 text-muted-foreground max-md:col-start-2 max-md:row-start-2 max-md:truncate max-md:p-0 max-md:text-xs"
                    >
                      {token.serviceName}
                    </td>
                    <td
                      role="cell"
                      className="px-5 py-3 max-md:col-start-3 max-md:row-start-1 max-md:p-0 max-md:text-right"
                    >
                      <span className="flex flex-col items-start gap-0.5 max-md:items-end">
                        <TokenStatusPill status={token.status} />
                        {others && (
                          <span className="text-xs text-muted-foreground">
                            with {token.assignedDoctorName}
                          </span>
                        )}
                      </span>
                    </td>
                    <td
                      role="cell"
                      className="px-5 py-3 max-md:col-start-3 max-md:row-start-2 max-md:p-0"
                    >
                      <TimeCell
                        row={row}
                        now={now}
                        timezone={view.clinic.timezone}
                        waitTargetMinutes={view.waitTargetMinutes}
                      />
                    </td>
                    <td
                      role="cell"
                      className={cn(
                        "px-5 py-3 text-right max-md:col-span-3 max-md:row-start-3 max-md:p-0 max-md:pt-1.5 max-md:text-left",
                        !button && "max-md:hidden",
                      )}
                    >
                      {button ?? (
                        <span className="text-muted-foreground">
                          <span aria-hidden>—</span>
                          <span className="sr-only">No action</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {blockedReason && counts.called > 0 && (
        <p className="border-t border-divider px-5 py-3 text-xs text-muted-foreground">
          {blockedReason}
        </p>
      )}
    </SegmentTabs>
  );
}

function sum(counts: Record<Kind, number>): number {
  return counts.inService + counts.called + counts.waiting + counts.done;
}
