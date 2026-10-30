import { z } from "zod";

// A clinic's slug is its permanent public address: /q/<slug>, printed on QR
// posters, so it is checked strictly and never reused.

export const SLUG_MIN = 3;
export const SLUG_MAX = 40;

// Words that would read as part of the product rather than a clinic.
const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "app",
  "clinic",
  "demo",
  "doctor",
  "help",
  "login",
  "queuecare",
  "receptionist",
  "signup",
  "super-admin",
  "support",
  "test",
  "www",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

export const clinicSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(SLUG_MIN, `Use at least ${SLUG_MIN} characters.`)
  .max(SLUG_MAX, `Use at most ${SLUG_MAX} characters.`)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers and single hyphens, e.g. sharma-clinic.",
  )
  .refine((slug) => !isReservedSlug(slug), "This address is reserved.");

// "Dr. Sharma's Clinic, Pune" → "dr-sharmas-clinic-pune".
export function suggestSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/, "");
}
