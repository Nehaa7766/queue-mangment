import { CoffeeIcon, TimerIcon, UserXIcon } from "lucide-react";
import {
  doctorsNeedingNotice,
  noDoctorOnDuty,
} from "@/features/doctor/availability";
import type {
  PatientDoctorNotice,
  QueueDoctorView,
} from "@/features/queue/contracts";
import { cn } from "@/lib/utils";
import { patientNoticeText, receptionDoctorText } from "./availability-display";

// Reception's live queue: which doctors for this service are on a break or
// running late, or that none is on duty (Phase 6).
export function QueueDoctorBanner({
  doctors,
  serviceName,
  now,
  className,
}: {
  doctors: readonly QueueDoctorView[];
  serviceName: string;
  now: number;
  className?: string;
}) {
  if (noDoctorOnDuty(doctors)) {
    return (
      <div
        role="status"
        className={cn(
          "flex items-start gap-2.5 rounded-card border border-border bg-status-off px-4 py-3 text-sm text-status-off-foreground",
          className,
        )}
      >
        <UserXIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
        <p>No doctor is on duty for {serviceName} right now.</p>
      </div>
    );
  }

  const notices = doctorsNeedingNotice(doctors);
  if (notices.length === 0) return null;
  return (
    <div
      role="status"
      aria-label="Doctor availability"
      className={cn(
        "rounded-card border border-border bg-status-wait px-4 py-3 text-sm text-status-wait-foreground",
        className,
      )}
    >
      <ul className="flex flex-col gap-1.5">
        {notices.map((doctor) => {
          const Icon =
            doctor.availability === "ON_BREAK" ? CoffeeIcon : TimerIcon;
          return (
            <li key={doctor.name} className="flex items-start gap-2.5">
              <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
              <p>
                <span className="font-semibold">{doctor.name}</span>{" "}
                {receptionDoctorText(doctor, now)}
                {doctor.note && <span> · “{doctor.note}”</span>}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// The patient's token page while they wait.
export function PatientDoctorNoticeBanner({
  notice,
}: {
  notice: PatientDoctorNotice | null | undefined;
}) {
  if (!notice) return null;
  const Icon = notice.kind === "ON_BREAK" ? CoffeeIcon : TimerIcon;
  return (
    <p className="flex items-start gap-2.5 rounded-card bg-status-wait p-4 text-base text-status-wait-foreground">
      <Icon aria-hidden className="mt-1 size-5 shrink-0" />
      <span>{patientNoticeText(notice)}</span>
    </p>
  );
}
