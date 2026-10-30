import { ChevronRight, MapPin } from "lucide-react";
import Link from "next/link";
import type {
  PublicClinicView,
  PublicServiceView,
} from "@/features/queue/contracts";
import { formatEta } from "./format";
import { messages } from "./messages";
import { QueueStatusPill } from "./status-pill";

const m = messages.clinic;

function ServiceDetails({ service }: { service: PublicServiceView }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="font-display text-lg font-bold">{service.name}</span>
      {service.description && (
        <span className="text-base text-muted-foreground">
          {service.description}
        </span>
      )}
      {service.queue ? (
        <span className="text-sm text-muted-foreground tabular-nums">
          {m.waiting(service.queue.waitingCount)} · ~
          {formatEta(service.queue.estimate)}
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">{m.noQueueToday}</span>
      )}
    </span>
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
  // Only open queues take new patients; the rest are shown but not clickable.
  if (clinicOpen && queue?.status === "OPEN") {
    return (
      <Link
        href={`/q/${clinicSlug}/join/${queue.queueId}`}
        className="flex min-h-12 items-center gap-3 rounded-card border border-border bg-card p-4 transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ServiceDetails service={service} />
        <ChevronRight
          aria-hidden="true"
          className="size-5 shrink-0 text-slate"
        />
      </Link>
    );
  }
  return (
    <div className="flex min-h-12 items-center gap-3 rounded-card border border-border bg-card p-4">
      <ServiceDetails service={service} />
      {queue && <QueueStatusPill status={queue.status} />}
    </div>
  );
}

export function ClinicLanding({ clinic }: { clinic: PublicClinicView }) {
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-[26px] font-bold">{clinic.name}</h1>
        <span
          className={
            clinic.isOpenNow
              ? "inline-flex w-fit items-center rounded-full bg-status-done px-3 py-1 text-sm font-semibold text-status-done-foreground"
              : "inline-flex w-fit items-center rounded-full bg-status-off px-3 py-1 text-sm font-semibold text-status-off-foreground"
          }
        >
          {clinic.isOpenNow ? m.openNow : m.closedNow}
        </span>
        {clinic.address && (
          <p className="flex items-start gap-2 text-base text-muted-foreground">
            <MapPin aria-hidden="true" className="mt-1 size-4 shrink-0" />
            {clinic.address}
          </p>
        )}
      </header>

      {!clinic.isOpenNow && (
        <p className="rounded-card bg-status-off p-4 text-base text-status-off-foreground">
          {m.closedBanner}
        </p>
      )}

      <section
        aria-labelledby="services-heading"
        className="flex flex-col gap-3"
      >
        <div className="flex flex-col gap-1">
          <h2 id="services-heading" className="font-display text-lg font-bold">
            {m.chooseService}
          </h2>
          <p className="text-base text-muted-foreground">
            {m.chooseServiceHint}
          </p>
        </div>

        {clinic.services.length === 0 ? (
          <p className="rounded-card border border-border bg-card p-4 text-base text-muted-foreground">
            {m.noServices}
          </p>
        ) : (
          <ul className="flex flex-col gap-3.5">
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
    </div>
  );
}
