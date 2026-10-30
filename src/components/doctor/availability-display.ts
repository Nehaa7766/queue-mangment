import type {
  DoctorAvailabilityStatus,
  PatientDoctorNotice,
  QueueDoctorView,
} from "@/features/queue/contracts";
import { minutesLeft } from "@/features/doctor/availability";

// Labels and status styles for doctor availability (docs/GUI_RULES.md §2).
// Color is never the only signal: every style comes with a label.

export const AVAILABILITY_DISPLAY: Record<
  DoctorAvailabilityStatus,
  { label: string; description: string; className: string }
> = {
  AVAILABLE: {
    label: "Available",
    description: "Seeing patients.",
    className: "bg-status-done text-status-done-foreground",
  },
  ON_BREAK: {
    label: "On break",
    description: "Reception and waiting patients see you're on a short break.",
    className: "bg-status-wait text-status-wait-foreground",
  },
  OFF_DUTY: {
    label: "Off duty",
    description: "Not seeing patients today.",
    className: "bg-status-off text-status-off-foreground",
  },
};

export function lateText(minutes: number): string {
  return `Running about ${minutes} min late`;
}

// Reception's line for one doctor, e.g. "on a break · back in about 10 min".
export function receptionDoctorText(
  doctor: QueueDoctorView,
  now: number,
): string {
  if (doctor.availability === "ON_BREAK") {
    const left = minutesLeft(doctor, now);
    return left > 0
      ? `is on a break · back in about ${left} min`
      : "is on a break";
  }
  if (doctor.availability === "OFF_DUTY") return "is off duty";
  return doctor.delayMinutes > 0
    ? `is running about ${doctor.delayMinutes} min late`
    : "is available";
}

// What a waiting patient reads. Never names a doctor.
// Assumption: these move to src/components/patient/messages.ts when the
// Hindi and Marathi toggle is added.
export function patientNoticeText(notice: PatientDoctorNotice): string {
  if (notice.kind === "ON_BREAK") {
    return notice.delayMinutes > 0
      ? `The doctor is on a short break and should be back in about ${notice.delayMinutes} min. You keep your place.`
      : "The doctor is on a short break. You keep your place.";
  }
  return `The doctor is running about ${notice.delayMinutes} min late. You keep your place.`;
}
