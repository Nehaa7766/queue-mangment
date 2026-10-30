import { z } from "zod";
import { openingHoursSchema } from "./opening-hours";

// Request bodies for /api/clinics/[clinicId]/settings and holidays. Shared by
// the route handlers and the admin forms, so both validate the same way.

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable();

export const clinicProfileSchema = z.object({
  name: z.string().trim().min(2, "Enter the clinic's name.").max(120),
  address: optionalText(200),
  phone: optionalText(30).refine(
    (value) => value === null || /^[+\d][\d\s()-]{5,}$/.test(value),
    "Enter a phone number with digits only, e.g. +91 98765 43210.",
  ),
  timezone: z.string().refine(isTimeZone, "Choose a valid time zone."),
});
export type ClinicProfileInput = z.infer<typeof clinicProfileSchema>;

export const queueSettingsSchema = z
  .object({
    waitTargetMinutes: z.int().min(5).max(240),
    gracePeriodSeconds: z.int().min(60).max(1800),
    // Null means no limit.
    maxQueueSize: z.int().min(1).max(1000).nullable(),
    noShowAction: z.enum(["SKIP", "REQUEUE"]),
    allowRequeue: z.boolean(),
    patientDataRetentionDays: z.int().min(1).max(365),
  })
  .refine((value) => value.allowRequeue || value.noShowAction === "SKIP", {
    path: ["noShowAction"],
    message: "Turn on requeue to send no-shows back to the queue.",
  });
export type QueueSettingsInput = z.infer<typeof queueSettingsSchema>;

export const settingsUpdateSchema = z.discriminatedUnion("section", [
  clinicProfileSchema.extend({ section: z.literal("profile") }),
  queueSettingsSchema.safeExtend({ section: z.literal("queue") }),
  z.object({
    section: z.literal("hours"),
    openingHours: openingHoursSchema,
  }),
]);
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;

export const holidayInputSchema = z.object({
  date: z.iso.date("Choose a date."),
  name: z.string().trim().min(1, "Give the holiday a name.").max(80),
});
export type HolidayInput = z.infer<typeof holidayInputSchema>;
