import type { ClinicStatus } from "@/generated/prisma/enums";

// The schema has only ACTIVE and INACTIVE, so "waiting for approval" and
// "suspended" are told apart by the clinic's latest platform audit action.
export type ClinicLifecycle = "ACTIVE" | "PENDING" | "SUSPENDED";

export const SIGNED_UP_ACTION = "clinic.signed_up";
export const ACTIVATED_ACTION = "clinic.activated";
export const SUSPENDED_ACTION = "clinic.suspended";

export function clinicLifecycle(
  status: ClinicStatus,
  latestAction: string | null,
): ClinicLifecycle {
  if (status === "ACTIVE") return "ACTIVE";
  return latestAction === SIGNED_UP_ACTION ? "PENDING" : "SUSPENDED";
}

export const LIFECYCLE_LABELS: Record<ClinicLifecycle, string> = {
  ACTIVE: "Active",
  PENDING: "Pending approval",
  SUSPENDED: "Suspended",
};
