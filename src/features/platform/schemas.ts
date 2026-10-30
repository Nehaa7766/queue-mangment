import { z } from "zod";
import type {
  SubscriptionStatus,
  SupportTicketStatus,
} from "@/generated/prisma/enums";

// Request schemas and labels shared by the platform API (server) and the
// platform screens (client). No database imports here.

// ---- Clinics and users ----

export const CLINIC_FILTERS = ["ACTIVE", "PENDING", "SUSPENDED"] as const;
export type ClinicFilter = (typeof CLINIC_FILTERS)[number];

export const clinicStatusUpdateSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export const userStatusUpdateSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

// ---- Subscriptions ----

export const SUBSCRIPTION_STATUSES = [
  "TRIALING",
  "ACTIVE",
  "PAST_DUE",
  "CANCELLED",
] as const satisfies readonly SubscriptionStatus[];

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  TRIALING: "Trial",
  ACTIVE: "Active",
  PAST_DUE: "Past due",
  CANCELLED: "Cancelled",
};

// Dates come from <input type="date"> as YYYY-MM-DD and are stored as
// midnight UTC of that day.
const dateOnly = z.iso.date("Use a valid date.").nullable();

export const subscriptionUpdateSchema = z.object({
  planId: z.uuid("Choose a plan."),
  status: z.enum(SUBSCRIPTION_STATUSES),
  trialEndsAt: dateOnly,
  currentPeriodEnd: dateOnly,
});
export type SubscriptionUpdate = z.infer<typeof subscriptionUpdateSchema>;

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
