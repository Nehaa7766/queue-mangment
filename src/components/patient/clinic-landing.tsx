import { ChevronRight, MapPin } from "lucide-react";
import Link from "next/link";
import type {
  PublicClinicView,
  PublicServiceView,
} from "@/features/queue/contracts";
import { cn } from "@/lib/utils";
import { formatEta } from "./format";
import { messages } from "./messages";
import { PatientBody, PatientStrip } from "./patient-page";
import { PILL, QueueStatusPill } from "./status-pill";

const m = messages.clinic;

function ServiceDetails({ service }: { service: PublicServiceView }) {
  return (
    <>
      <span
        aria-hidden="true"
        className="flex size-11 shrink-0 items-center justify-center rounded-btn bg-brand-tint font-display text-lg font-extrabold text-brand"
      >
        {service.tokenPrefix}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-base font-semibold">{service.name}</span>
        {service.description && (
          <span className="text-sm text-muted-foreground">
            {service.description}
          </span>
        )}
        {service.queue ? (
          <span className="text-sm text-muted-foreground tabular-nums">
            {m.waiting(service.queue.waitingCount)} · ~
            {formatEta(service.queue.estimate)}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">
            {m.noQueueToday}
          </span>
        )}
      </span>
    </>
  );
}

function ServiceRow({
  clinicSlug,
  clinicOpen,
  service,
}: {
  clinicSlug: string;
  clinicOpen: boolean;
  service: PublicServiceView;
}) {
  const queue = service.queue;
  const rowClass = "flex min-h-[72px] items-center gap-3.5 px-5 py-4";
  // Only open queues take new patients; the rest are shown but not clickable.
  if (clinicOpen && queue?.status === "OPEN") {
    return (
      <Link
        href={`/q/${clinicSlug}/join/${queue.queueId}`}
        className={cn(
          rowClass,
          "transition-colors outline-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
        )}
      >
        <ServiceDetails service={service} />
        <ChevronRight
          aria-hidden="true"
          className="size-5 shrink-0 text-brand"
        />
      </Link>
    );
  }
  return (
    <div className={rowClass}>
      <ServiceDetails service={service} />
      {queue && <QueueStatusPill status={queue.status} />}
    </div>
  );
}

export function ClinicLanding({ clinic }: { clinic: PublicClinicView }) {
  return (
    <>
      <PatientStrip
        title={clinic.name}
        aside={
          <span
            className={cn(
              PILL,
              clinic.isOpenNow
                ? "bg-status-done text-status-done-foreground"
                : "bg-status-off text-status-off-foreground",
            )}
          >
            {clinic.isOpenNow ? m.openNow : m.closedNow}
          </span>
        }
      >
        {clinic.address && (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {clinic.address}
          </p>
        )}
      </PatientStrip>

      <PatientBody>
        {!clinic.isOpenNow && (
          <p className="rounded-card border border-border bg-status-off p-4 text-base text-status-off-foreground">
            {m.closedBanner}
          </p>
        )}

        <section
          aria-labelledby="services-heading"
          className="overflow-hidden rounded-card border border-border bg-card shadow-card"
        >
          <div className="border-b border-divider px-5 py-4">
            <h2 id="services-heading" className="text-base font-semibold">
              {m.chooseService}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {m.chooseServiceHint}
            </p>
          </div>

          {clinic.services.length === 0 ? (
            <p className="p-5 text-base text-muted-foreground">
              {m.noServices}
            </p>
          ) : (
            <ul className="divide-y divide-divider">
              {clinic.services.map((service) => (
                <li key={service.serviceId}>
                  <ServiceRow
                    clinicSlug={clinic.slug}
                    clinicOpen={clinic.isOpenNow}
                    service={service}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </PatientBody>
    </>
  );
}
