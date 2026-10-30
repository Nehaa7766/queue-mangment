import type { MembershipRole } from "@/generated/prisma/enums";

// Only doctors use the doctor panel; everyone else gets /unauthorized.
export const DOCTOR_ROLES = [
  "DOCTOR",
] as const satisfies readonly MembershipRole[];
