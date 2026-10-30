import { z } from "zod";
import type { ClinicType } from "@/generated/prisma/enums";
import { WEEKDAYS, type OpeningHours, type Weekday } from "./opening-hours";

// Clinic profile fields beyond name and address: type, contact email, city,
// state, PIN code, logo, and simple working hours. Client-safe (no server
// imports), so the super-admin and clinic-admin forms validate exactly like
// the API routes do.

export const CLINIC_TYPES = [
  "GENERAL",
  "DENTAL",
  "PEDIATRIC",
  "GYNECOLOGY",
  "ORTHOPEDIC",
  "DERMATOLOGY",
  "ENT",
  "EYE",
  "MULTI_SPECIALTY",
  "DIAGNOSTIC",
  "OTHER",
] as const satisfies readonly ClinicType[];

export const CLINIC_TYPE_LABELS: Record<ClinicType, string> = {
  GENERAL: "General",
  DENTAL: "Dental",
  PEDIATRIC: "Pediatric",
  GYNECOLOGY: "Gynecology",
  ORTHOPEDIC: "Orthopedic",
  DERMATOLOGY: "Dermatology",
  ENT: "ENT",
  EYE: "Eye",
  MULTI_SPECIALTY: "Multi-specialty",
  DIAGNOSTIC: "Diagnostic",
  OTHER: "Other",
};

// The 28 states and 8 union territories, for the State select.
export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

// Six digits, not starting with 0.
export const PIN_CODE_PATTERN = /^[1-9]\d{5}$/;

export const LOGO_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
export const LOGO_MAX_BYTES = 512 * 1024;

const emptyToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(emptyToNull, schema.nullable());

export const clinicDetailsSchema = z.object({
  clinicType: z.enum(CLINIC_TYPES, "Choose the type of clinic."),
  email: optional(
    z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email("Enter a valid email address.")),
  ),
  city: optional(z.string().trim().max(80)),
  state: optional(z.enum(INDIAN_STATES, "Choose a state from the list.")),
  pinCode: optional(
    z
      .string()
      .trim()
      .regex(PIN_CODE_PATTERN, "Enter a 6-digit PIN code, e.g. 411001."),
  ),
});
export type ClinicDetailsInput = z.infer<typeof clinicDetailsSchema>;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const time = (label: string) =>
  z.string().regex(TIME, `Enter the ${label} as a 24-hour time, e.g. 09:00.`);

// One opening and closing time shared by the chosen working days.
export const simpleHoursSchema = z
  .object({
    openingTime: time("opening time"),
    closingTime: time("closing time"),
    workingDays: z
      .array(z.enum(WEEKDAYS))
      .min(1, "Choose at least one working day."),
  })
  .refine((hours) => hours.closingTime > hours.openingTime, {
    path: ["closingTime"],
    message: "Closing time must be after opening time.",
  });
export type SimpleHours = z.infer<typeof simpleHoursSchema>;

// Stored as Clinic.openingHours, the shape isOpenNow reads.
export function hoursFromSimple(simple: SimpleHours): OpeningHours {
  const hours: OpeningHours = {};
  for (const day of WEEKDAYS) {
    if (simple.workingDays.includes(day)) {
      hours[day] = [[simple.openingTime, simple.closingTime]];
    }
  }
  return hours;
}

// The simple form of stored hours, or null when they don't fit it (several
// ranges a day, different times on different days, or no hours set). Then
// the detailed editor in clinic settings is the place to change them.
export function simpleFromHours(stored: unknown): SimpleHours | null {
  if (stored === null || typeof stored !== "object") return null;
  const hours = stored as Record<string, unknown>;
  const workingDays: Weekday[] = [];
  let range: [string, string] | null = null;
  for (const day of WEEKDAYS) {
    const ranges = hours[day];
    if (ranges === undefined) continue;
    if (!Array.isArray(ranges) || ranges.length !== 1) return null;
    const [start, end] = ranges[0] as unknown[];
    if (typeof start !== "string" || typeof end !== "string") return null;
    if (range && (range[0] !== start || range[1] !== end)) return null;
    range = [start, end];
    workingDays.push(day);
  }
  if (!range) return null;
  return { openingTime: range[0], closingTime: range[1], workingDays };
}

// A logo as the forms send it: the file read as base64 (a data: URL prefix is
// allowed). Size and file signature are checked again on the server.
export const logoUploadSchema = z.object({
  contentType: z.enum(LOGO_CONTENT_TYPES, "Use a PNG, JPG or WebP image."),
  base64: z
    .string()
    .min(1)
    // base64 is 4/3 the file size; a little slack for a data: prefix.
    .max(
      Math.ceil((LOGO_MAX_BYTES * 4) / 3) + 64,
      "The logo must be 512 KB or smaller.",
    ),
});
export type LogoUpload = z.infer<typeof logoUploadSchema>;
