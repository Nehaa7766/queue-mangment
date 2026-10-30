import { z } from "zod";
import {
  clinicDetailsSchema as clinicProfileSchema,
  logoUploadSchema,
  simpleHoursSchema,
} from "@/features/clinics/profile-fields";
import { isValidTimeZone } from "@/features/onboarding/signup-schema";
import { clinicSlugSchema } from "@/features/onboarding/slug";
import { isValidTokenPrefix } from "@/features/queue/token-label";
import type { SupportTicketStatus } from "@/generated/prisma/enums";

// Request schemas and labels shared by the platform API (server) and the
// platform screens (client). No database imports here.

const personName = z
  .string()
  .trim()
  .min(2, "Enter a name.")
  .max(80, "Use at most 80 characters.");

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."));

// Optional text: an empty field is stored as null. The forms send their parsed
// values, so the API must accept that null as well as an empty string.
function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters.`)
    .nullish()
    .transform((value) => (value ? value : null));
}

// ---- Clinics and users ----

export const CLINIC_FILTERS = ["ACTIVE", "PENDING", "SUSPENDED"] as const;
export type ClinicFilter = (typeof CLINIC_FILTERS)[number];

export const clinicStatusUpdateSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export const userStatusUpdateSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export const CLINIC_STATUSES = ["ACTIVE", "INACTIVE"] as const;

// Every clinic field the super admin sets, on add and on edit.
const clinicFields = {
  name: z
    .string()
    .trim()
    .min(2, "Enter the clinic's name.")
    .max(80, "Use at most 80 characters."),
  slug: clinicSlugSchema,
  timezone: z.string().refine(isValidTimeZone, "Choose a valid time zone."),
  status: z.enum(CLINIC_STATUSES, "Choose active or inactive."),
  phone: optionalText(30).refine(
    (phone) => phone === null || /^[0-9+()\s-]+$/.test(phone),
    "Use digits, spaces, +, - and brackets only.",
  ),
  address: optionalText(200),
  // Type, email, city, state and PIN code, as the clinic settings use them.
  ...clinicProfileSchema.shape,
  // Left out keeps the logo; null removes it.
  logo: logoUploadSchema.nullable().optional(),
};

// Edit. `hours` null keeps the clinic's custom hours (split or per-day
// hours set in clinic settings) as they are.
export const clinicDetailsSchema = z.object({
  ...clinicFields,
  hours: simpleHoursSchema.nullable(),
});
export type ClinicDetailsInput = z.infer<typeof clinicDetailsSchema>;

// A super admin adds a clinic with its hours, its first service and its
// first admin, who is invited by email (or added directly if they already
// have an account).
export const clinicCreateSchema = z.object({
  ...clinicFields,
  hours: simpleHoursSchema,
  serviceName: z
    .string()
    .trim()
    .min(2, "Name the first service, e.g. General.")
    .max(60, "Use at most 60 characters."),
  tokenPrefix: z
    .string()
    .trim()
    .toUpperCase()
    .refine(isValidTokenPrefix, "Use 1 to 3 letters, e.g. A."),
  adminName: personName,
  adminEmail: email,
});
export type ClinicCreateInput = z.infer<typeof clinicCreateSchema>;

// Deleting asks for the clinic's address typed out, so a slip can't do it.
export const clinicDeleteSchema = z.object({
  confirmSlug: z.string().trim().max(80),
});

export const userInputSchema = z.object({ name: personName, email });
export type UserInput = z.infer<typeof userInputSchema>;

// The super admin adds clinic admins; each admin then adds their own staff.
export const adminCreateSchema = userInputSchema.extend({
  clinicId: z.uuid("Choose a clinic."),
});
export type AdminCreateInput = z.infer<typeof adminCreateSchema>;

// The two lists on the Users page.
export const USER_TABS = ["admins", "staff"] as const;
export type UserTab = (typeof USER_TABS)[number];
export const USER_TAB_LABELS: Record<UserTab, string> = {
  admins: "Clinic admins",
  staff: "Clinic staff",
};

// ---- Support ----

export const SUPPORT_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
] as const satisfies readonly SupportTicketStatus[];

export const SUPPORT_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
};

export const supportTicketCreateSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(3, "Add a short subject.")
    .max(160, "Use at most 160 characters."),
  body: z
    .string()
    .trim()
    .min(10, "Describe the problem in a sentence or two.")
    .max(5000, "Use at most 5,000 characters."),
});
export type SupportTicketCreate = z.infer<typeof supportTicketCreateSchema>;

export const supportTicketUpdateSchema = z.object({
  status: z.enum(SUPPORT_STATUSES),
});

// A super admin edits a ticket's text and status.
export const supportTicketEditSchema = supportTicketCreateSchema.extend({
  status: z.enum(SUPPORT_STATUSES),
});
export type SupportTicketEdit = z.infer<typeof supportTicketEditSchema>;

// ...or opens one on a clinic's behalf (or about the platform: no clinic).
export const supportTicketAdminCreateSchema = supportTicketEditSchema.extend({
  clinicId: z.uuid("Choose a clinic.").nullable(),
});
export type SupportTicketAdminCreate = z.infer<
  typeof supportTicketAdminCreateSchema
>;
