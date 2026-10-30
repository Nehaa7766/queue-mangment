import { z } from "zod";
import type {
  DoctorAvailabilityStatus,
  PatientDoctorNotice,
  QueueDoctorView,
} from "@/features/queue/contracts";

// Doctor availability rules (docs/PLAN.md §3, Phase 6). Pure, so the banner
// logic is easy to test and identical for reception and patients.

export const DOCTOR_AVAILABILITIES = [
  "AVAILABLE",
  "ON_BREAK",
  "OFF_DUTY",
] as const satisfies readonly DoctorAvailabilityStatus[];

export const MAX_DELAY_MINUTES = 240;
export const MAX_NOTE_LENGTH = 120;

export const availabilityBodySchema = z
  .object({
    availability: z.enum(DOCTOR_AVAILABILITIES),
    delayMinutes: z.number().int().min(0).max(MAX_DELAY_MINUTES).default(0),
    note: z
      .string()
      .trim()
      .max(MAX_NOTE_LENGTH)
      .nullish()
      .transform((note) => note || null),
  })
  // Off duty means no announced delay; keep the stored value clean.
  .transform((body) =>
    body.availability === "OFF_DUTY" ? { ...body, delayMinutes: 0 } : body,
  );

export type AvailabilityBody = z.input<typeof availabilityBodySchema>;
export type AvailabilityUpdate = z.output<typeof availabilityBodySchema>;

// Minutes left of an announced break, counted from when it was set.
export function minutesLeft(
  doctor: Pick<QueueDoctorView, "delayMinutes" | "updatedAt">,
  now: number,
): number {
  if (doctor.delayMinutes <= 0) return 0;
  if (!doctor.updatedAt) return doctor.delayMinutes;
  const elapsed = Math.floor((now - Date.parse(doctor.updatedAt)) / 60_000);
  return Math.max(0, doctor.delayMinutes - Math.max(0, elapsed));
}

// What patients see. Doctors who are off duty are ignored; if no one else
// serves the service there is nothing useful to say, so no notice.
// - Nobody available but someone on a break: "on a short break", with the
//   soonest expected return.
// - Someone available but every available doctor running late: "running
//   about N min late", with the smallest delay.
export function patientDoctorNotice(
  doctors: readonly QueueDoctorView[],
  now: number,
): PatientDoctorNotice | null {
  const onDuty = doctors.filter((doctor) => doctor.availability !== "OFF_DUTY");
  if (onDuty.length === 0) return null;

  const available = onDuty.filter(
    (doctor) => doctor.availability === "AVAILABLE",
  );
  if (available.length === 0) {
    const returns = onDuty
      .map((doctor) => minutesLeft(doctor, now))
      .filter((minutes) => minutes > 0);
    return {
      kind: "ON_BREAK",
      delayMinutes: returns.length > 0 ? Math.min(...returns) : 0,
    };
  }

  const delay = Math.min(...available.map((doctor) => doctor.delayMinutes));
  return delay > 0 ? { kind: "DELAYED", delayMinutes: delay } : null;
}

// Doctors reception should hear about: on a break or running late.
export function doctorsNeedingNotice(
  doctors: readonly QueueDoctorView[],
): QueueDoctorView[] {
  return doctors.filter(
    (doctor) =>
      doctor.availability === "ON_BREAK" ||
      (doctor.availability === "AVAILABLE" && doctor.delayMinutes > 0),
  );
}

// True when the service has doctors but none of them is on duty.
export function noDoctorOnDuty(doctors: readonly QueueDoctorView[]): boolean {
  return (
    doctors.length > 0 &&
    doctors.every((doctor) => doctor.availability === "OFF_DUTY")
  );
}
