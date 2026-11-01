"use client";

import { useState } from "react";
import { ListRow, TokenBadge } from "@/components/dashboard/list-row";
import { SegmentTabs } from "@/components/dashboard/segment-tabs";
import {
  consultationMinutes,
  durationMinutes,
} from "@/components/doctor/patient-display";
import { MessagePatientButton } from "@/components/messaging/message-patient-button";
import { Button } from "@/components/ui/button";
import type {
  StaffQueueView,
  StaffTokenView,
} from "@/features/queue/contracts";
import { queueTabGroups, type QueueTab } from "./live-queue-state";
import { MiniTicketRow } from "./mini-ticket-row";
import { TokenStatusPill } from "./status-pill";
import { displayName, formatClinicTime } from "./token-display";

const EMPTY = "px-5 py-8 text-center text-sm text-muted-foreground";
const ROW = "flex flex-wrap items-center gap-3 py-3.5";

const details = (token: StaffTokenView) => `/receptionist/tokens/${token.id}`;

// Today's patients under the Now serving ticket, one tab per stage. Counts
// follow the live view, so a patient the doctor completes moves to Completed
// on the next poll, and reception's own actions move straight away.
export function QueueTabs({
  view,
  featuredId,
  now,
  timezone,
  disabled,
  onRecall,
  onSkip,
  onRequeue,
  messagesHref,
}: {
  view: StaffQueueView;
  featuredId: string | null;
  now: number;
  timezone: string;
  disabled: boolean;
  onRecall: (token: StaffTokenView) => void;
  onSkip: (token: StaffTokenView) => void;
  onRequeue: (token: StaffTokenView) => void;
  // The panel's Messages page; adds a Message action to waiting and called
  // patients.
  messagesHref?: string;
}) {
  const [tab, setTab] = useState<QueueTab>("upNext");
  const message = (token: StaffTokenView) =>
    messagesHref ? (
      <MessagePatientButton
        tokenId={token.id}
        tokenLabel={token.tokenLabel}
        patientName={displayName(token.patientName)}
        messagesHref={messagesHref}
        compact
      />
    ) : null;
  const groups = queueTabGroups(view, featuredId);
  const time = (iso: string | null) =>
    iso ? formatClinicTime(iso, timezone) : null;

  return (
    <SegmentTabs
      label="Today's patients"
      idBase="reception-patients"
      value={tab}
      onChange={setTab}
      tabs={[
        { key: "upNext", label: "Up next", count: groups.counts.upNext },
        {
          key: "inService",
          label: "In consultation",
          count: groups.counts.inService,
        },
        {
          key: "completed",
          label: "Completed",
          count: groups.counts.completed,
        },
        {
          key: "missed",
          label: "No-show / Cancelled",
          count: groups.counts.missed,
        },
      ]}
    >
      {tab === "upNext" && (
        <div className="flex flex-col">
          {groups.called.length > 0 && (
            <section
              aria-labelledby="reception-also-called"
              className="border-b border-divider px-5 pt-3"
            >
              <h3
                id="reception-also-called"
                className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase"
              >
                Also called · not yet with a doctor
              </h3>
              <ul className="divide-y divide-divider">
                {groups.called.map((token) => (
                  <li key={token.id} className={ROW}>
                    <TokenBadge label={token.tokenLabel} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-semibold">
                        {displayName(token.patientName)}
                      </span>
                      <span className="truncate text-xs text-muted-foreground tabular-nums">
                        Called {time(token.calledAt) ?? ""}
                        {token.recallCount > 0 &&
                          ` · recalled ${token.recallCount}×`}
                      </span>
                    </span>
                    <span className="flex gap-2">
                      {message(token)}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 rounded-btn"
                        disabled={disabled}
                        onClick={() => onRecall(token)}
                      >
                        Recall
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 rounded-btn"
                        disabled={disabled}
                        onClick={() => onSkip(token)}
                      >
                        Skip
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {groups.waiting.length === 0 ? (
            <p className={EMPTY}>
              No one is waiting. New patients appear here as they join.
            </p>
          ) : (
            <div className="flex flex-col gap-3 p-5">
              <p className="text-xs text-muted-foreground">
                In queue order. Open a row for the token&apos;s details.
              </p>
              <ol className="flex flex-col gap-2">
                {groups.waiting.map((token, index) => (
                  <MiniTicketRow
                    key={token.id}
                    token={token}
                    isNext={index === 0}
                    now={now}
                    waitTargetMinutes={view.settings.waitTargetMinutes}
                    href={details(token)}
                    action={message(token)}
                  />
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {tab === "inService" &&
        (groups.inService.length === 0 ? (
          <p className={EMPTY}>No one is with a doctor right now.</p>
        ) : (
          <ul className="divide-y divide-divider px-5">
            {groups.inService.map((token) => {
              const minutes = consultationMinutes(token, now);
              const started = time(token.serviceStartedAt);
              return (
                <li key={token.id}>
                  <ListRow
                    href={details(token)}
                    leading={<TokenBadge label={token.tokenLabel} />}
                    title={displayName(token.patientName)}
                    // Time first, so it survives truncation on phones.
                    subtitle={[
                      started && `Started ${started}`,
                      token.assignedDoctorName
                        ? `with ${token.assignedDoctorName}`
                        : "with a doctor",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    trailing={minutes === null ? null : `${minutes} min`}
                    trailingSub={minutes === null ? null : "so far"}
                  />
                </li>
              );
            })}
          </ul>
        ))}

      {tab === "completed" &&
        (groups.completed.length === 0 ? (
          <p className={EMPTY}>
            No completed consultations yet today. Patients move here when the
            doctor completes them.
          </p>
        ) : (
          <ul className="divide-y divide-divider px-5">
            {groups.completed.map((token) => {
              const minutes = durationMinutes(token);
              const completed = time(token.completedAt);
              return (
                <li key={token.id}>
                  <ListRow
                    href={details(token)}
                    leading={
                      <TokenBadge label={token.tokenLabel} tone="muted" />
                    }
                    title={displayName(token.patientName)}
                    subtitle={[
                      completed && `Completed ${completed}`,
                      token.assignedDoctorName,
                      token.serviceName,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    trailing={minutes === null ? null : `${minutes} min`}
                    trailingSub={minutes === null ? null : "consultation"}
                  />
                </li>
              );
            })}
          </ul>
        ))}

      {tab === "missed" &&
        (groups.missed.length === 0 ? (
          <p className={EMPTY}>No no-shows or cancellations today.</p>
        ) : (
          <ul className="divide-y divide-divider px-5">
            {groups.missed.map((token) => {
              const called = time(token.calledAt);
              return (
                <li key={token.id} className={ROW}>
                  <TokenBadge label={token.tokenLabel} tone="muted" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold">
                      {displayName(token.patientName)}
                    </span>
                    <span className="truncate text-xs text-muted-foreground tabular-nums">
                      {called
                        ? `Called ${called}`
                        : `Joined ${time(token.joinedAt)}`}
                    </span>
                  </span>
                  <TokenStatusPill status={token.status} />
                  {token.status === "SKIPPED" && view.settings.allowRequeue && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 rounded-btn"
                      disabled={disabled}
                      onClick={() => onRequeue(token)}
                    >
                      Requeue
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        ))}
    </SegmentTabs>
  );
}
