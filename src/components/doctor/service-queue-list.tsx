import { MiniTicketRow } from "@/components/queue/mini-ticket-row";
import { QueueStatusPill } from "@/components/queue/status-pill";
import type { DoctorServiceView } from "@/features/doctor/contracts";
import type { StaffTokenView } from "@/features/queue/contracts";

// Waiting patients per service, in queue order. `limit` caps the rows shown
// per service (the dashboard shows a preview; the queue page shows all).
export function ServiceQueueList({
  services,
  waiting,
  now,
  waitTargetMinutes,
  limit,
}: {
  services: readonly DoctorServiceView[];
  waiting: readonly StaffTokenView[];
  now: number;
  waitTargetMinutes: number;
  limit?: number;
}) {
  if (services.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
        No active services are assigned to you. Ask your clinic admin to assign
        one.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {services.map((service) => {
        const tokens = waiting.filter((t) => t.serviceName === service.name);
        const shown = limit === undefined ? tokens : tokens.slice(0, limit);
        const headingId = `service-${service.serviceId}`;
        return (
          <section
            key={service.serviceId}
            aria-labelledby={headingId}
            className="flex flex-col gap-2"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h3
                id={headingId}
                className="flex items-center gap-2 text-sm font-semibold"
              >
                <span className="font-display font-extrabold">
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
              <p className="rounded-[10px] border border-dashed border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                {service.queueId
                  ? "No one is waiting."
                  : "No queue for this service today."}
              </p>
            ) : (
              <ol className="flex flex-col gap-2">
                {shown.map((token, index) => (
                  <MiniTicketRow
                    key={token.id}
                    token={token}
                    isNext={index === 0}
                    now={now}
                    waitTargetMinutes={waitTargetMinutes}
                  />
                ))}
              </ol>
            )}
            {shown.length < tokens.length && (
              <p className="text-xs text-muted-foreground tabular-nums">
                and {tokens.length - shown.length} more
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
