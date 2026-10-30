import type { MembershipRole } from "@/generated/prisma/enums";

export const ACTIONS = [
  "queue.view",
  "queue.callNext",
  "queue.recall",
  "queue.skip",
  "queue.requeue",
  "queue.pauseResume",
  "walkIn.create",
  "consultation.start",
  "consultation.complete",
  "doctor.availability",
  "clinic.settings",
  "services.manage",
  "staff.manage",
  "analytics.view",
  "audit.view",
] as const;

export type Action = (typeof ACTIONS)[number];

const RECEPTION_ACTIONS = [
  "queue.view",
  "queue.callNext",
  "queue.recall",
  "queue.skip",
  "queue.requeue",
  "queue.pauseResume",
  "walkIn.create",
] as const satisfies readonly Action[];

// Server-side source of truth for who may do what (docs/PLAN.md §3).
// Hiding a button in the UI is not a substitute for checking this.
const PERMISSIONS: Record<MembershipRole, readonly Action[]> = {
  RECEPTIONIST: RECEPTION_ACTIONS,
  // Assumption: doctors start and complete consultations but reception
  // calls patients. Revisit if the pilot clinic's doctors call their own.
  DOCTOR: [
    "queue.view",
    "consultation.start",
    "consultation.complete",
    "doctor.availability",
  ],
  // Admins can run the front desk too, but don't act as doctors.
  CLINIC_ADMIN: [
    ...RECEPTION_ACTIONS,
    "clinic.settings",
    "services.manage",
    "staff.manage",
    "analytics.view",
    "audit.view",
  ],
};

export function can(role: MembershipRole, action: Action): boolean {
  return PERMISSIONS[role].includes(action);
}
