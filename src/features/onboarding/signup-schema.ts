import { z } from "zod";
import { isValidTokenPrefix } from "@/features/queue/token-label";
import { clinicSlugSchema } from "./slug";

// Shared by the signup form (client) and the signup endpoint (server).

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

// Offered in the form. The server accepts any valid IANA time zone.
export const TIMEZONE_OPTIONS = [
  { value: "Asia/Kolkata", label: "India (Asia/Kolkata)" },
  { value: "Asia/Kathmandu", label: "Nepal (Asia/Kathmandu)" },
  { value: "Asia/Dhaka", label: "Bangladesh (Asia/Dhaka)" },
  { value: "Asia/Colombo", label: "Sri Lanka (Asia/Colombo)" },
  { value: "Asia/Dubai", label: "UAE (Asia/Dubai)" },
  { value: "Asia/Singapore", label: "Singapore (Asia/Singapore)" },
  { value: "Europe/London", label: "UK (Europe/London)" },
  { value: "UTC", label: "UTC" },
] as const;

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

// Better Auth's default minimum for email and password sign-in.
export const PASSWORD_MIN = 8;

export const signupSchema = z.object({
  clinicName: z
    .string()
    .trim()
    .min(2, "Enter the clinic's name.")
    .max(80, "Use at most 80 characters."),
  clinicSlug: clinicSlugSchema,
  timezone: z.string().refine(isValidTimeZone, "Choose a valid time zone."),
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
  serviceMinutes: z
    .number({ error: "Enter the usual minutes per patient." })
    .int("Use whole minutes.")
    .min(1, "Use at least 1 minute.")
    .max(240, "Use at most 240 minutes."),
  adminName: z
    .string()
    .trim()
    .min(2, "Enter your name.")
    .max(80, "Use at most 80 characters."),
  adminEmail: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.")),
  password: z
    .string()
    .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
    .max(128, "Use at most 128 characters."),
});

export type SignupInput = z.infer<typeof signupSchema>;

// The fields each wizard step owns, so a step can be checked on its own.
export const SIGNUP_STEPS = [
  { title: "Clinic", fields: ["clinicName", "clinicSlug", "timezone"] },
  {
    title: "First service",
    fields: ["serviceName", "tokenPrefix", "serviceMinutes"],
  },
  { title: "Your account", fields: ["adminName", "adminEmail", "password"] },
] as const satisfies readonly {
  title: string;
  fields: readonly (keyof SignupInput)[];
}[];

// ---- Response bodies ----

export type SignupResponse = {
  clinicSlug: string;
  // New clinics wait for a platform admin to activate them.
  status: "PENDING_APPROVAL";
};

export type SlugAvailabilityResponse = {
  slug: string;
  available: boolean;
  reason?: string;
};
