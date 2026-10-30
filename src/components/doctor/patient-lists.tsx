import { TokenBadge } from "@/components/dashboard/list-row";
import { QueueStatusPill } from "@/components/queue/status-pill";
import {
  displayName,
  formatClinicTime,
} from "@/components/queue/token-display";
import type { DoctorServiceView } from "@/features/doctor/contracts";
import type { StaffTokenView } from "@/features/queue/contracts";
import { cn } from "@/lib/utils";
import {
  consultationMinutes,
  durationMinutes,
  timeRange,
  waitedMinutes,
} from "./patient-display";

// Full patient lists for the doctor's dashboard tabs. No row limits: the
// doctor sees every patient in their services.

const EMPTY = "px-5 py-8 text-center text-sm text-muted-foreground";
const ROW = "flex items-center gap-3 py-3.5";

function PatientText({
  name,
  detail,
}: {
  name: string | null;
  detail: string;
}) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate text-sm font-semibold">
        {displayName(name)}
      </span>
      <span className="truncate text-xs text-muted-foreground tabular-nums">
        {detail}
      </span>
    </span>
  );
}

function Trailing({ value, caption }: { value: string; caption: string }) {
  return (
    <span className="flex shrink-0 flex-col items-end">
      <span className="text-sm font-semibold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{caption}</span>
    </span>
  );
}

// Everyone in consultation in the doctor's services, with whichever doctor.
export function InServiceList({
  tokens,
  currentId,
  now,
  timezone,
}: {
  tokens: readonly StaffTokenView[];
  currentId: string | null;
  now: number;
  timezone: string;
}) {
  if (tokens.length === 0) {
    return <p className={EMPTY}>No one is in consultation right now.</p>;
  }
  return (
    <ul className="divide-y divide-divider px-5">
      {tokens.map((token) => {
        const minutes = consultationMinutes(token, now);
        const who =
          token.id === currentId
            ? "with you"
            : token.assignedDoctorName
              ? `with ${token.assignedDoctorName}`
              : "with a doctor";
        const started = token.serviceStartedAt
          ? ` · started ${formatClinicTime(token.serviceStartedAt, timezone)}`
          : "";
        return (
          <li key={token.id} className={ROW}>
            <TokenBadge label={token.tokenLabel} />
            <PatientText
              name={token.patientName}
              detail={`${token.serviceName} · ${who}${started}`}
            />
            {minutes !== null && (
              <Trailing value={`${minutes} min`} caption="so far" />
            )}
          </li>
        );
      })}
    </ul>
  );
}

// Waiting patients per service, in queue order, with every row shown.
export function WaitingByService({
  services,
  waiting,
  now,
  timezone,
  waitTargetMinutes,
}: {
  services: readonly DoctorServiceView[];
  waiting: readonly StaffTokenView[];
  now: number;
  timezone: string;
  waitTargetMinutes: number;
}) {
  if (services.length === 0) {
    return (
      <p className={EMPTY}>
        No active services are assigned to you. Ask your clinic admin to assign
        one.
      </p>
    );
  }
  return (
    <div className="flex flex-col divide-y divide-divider">
      {services.map((service) => {
        const tokens = waiting.filter((t) => t.serviceName === service.name);
        const headingId = `waiting-${service.serviceId}`;
        return (
          <section
            key={service.serviceId}
            aria-labelledby={headingId}
            className="flex flex-col px-5 py-3"
          >
            <div className="flex flex-wrap items-center gap-2 py-1">
              <h3
                id={headingId}
                className="flex items-center gap-2 text-sm font-semibold"
              >
                <span className="flex size-6 items-center justify-center rounded-md bg-muted font-display text-xs font-extrabold">
                  {service.tokenPrefix}
                </span>
                {service.name}
                <span className="font-normal text-muted-foreground tabular-nums">
                  · {service.waitingCount} waiting
                </span>
              </h3>
              {service.queueStatus && service.queueStatus !== "OPEN" && (
                <QueueStatusPill status={service.queueStatus} />
              )}
            </div>
            {tokens.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                {service.queueId
                  ? "No one is waiting."
                  : "No queue for this service today."}
              </p>
            ) : (
              <ol className="divide-y divide-divider">
                {tokens.map((token, index) => {
                  const waited = waitedMinutes(token, now);
                  const over = waited > waitTargetMinutes;
                  return (
                    <li key={token.id} className={ROW}>
                      <span className="w-6 shrink-0 text-right text-xs font-semibold text-muted-foreground tabular-nums">
                        {index + 1}
                      </span>
                      <TokenBadge label={token.tokenLabel} tone="muted" />
                      <PatientText
                        name={token.patientName}
                        detail={`Joined ${formatClinicTime(token.joinedAt, timezone)}${index === 0 ? " · next up" : ""}`}
                      />
                      <span className="flex shrink-0 flex-col items-end">
                        <span
                          className={cn(
                            "text-sm font-semibold tabular-nums",
                            over && "text-danger-text",
                          )}
                        >
                          {waited} min
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {over ? "over target" : "waited"}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}

// The doctor's own finished consultations today, newest first.
export function DoneTodayList({
  tokens,
  timezone,
}: {
  tokens: readonly StaffTokenView[];
  timezone: string;
}) {
  if (tokens.length === 0) {
    return <p className={EMPTY}>No completed consultations yet today.</p>;
  }
  return (
    <ul className="divide-y divide-divider px-5">
      {tokens.map((token) => {
        const minutes = durationMinutes(token);
        const range = timeRange(token, timezone);
        return (
          <li key={token.id} className={ROW}>
            <TokenBadge label={token.tokenLabel} tone="muted" />
            <PatientText
              name={token.patientName}
              detail={
                range ? `${token.serviceName} · ${range}` : token.serviceName
              }
            />
            {minutes !== null && (
              <Trailing value={`${minutes} min`} caption="consultation" />
            )}
          </li>
        );
      })}
    </ul>
  );
}
