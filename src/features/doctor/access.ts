import { z } from "zod";
import {
  requireClinicPermission,
  requireSession,
  type ClinicAccess,
} from "@/lib/auth/guards";
import type { Action } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";

const uuidSchema = z.uuid();

export type DoctorAccess = ClinicAccess & {
  clinic: { id: string; name: string; timezone: string };
};

// The signed-in user acting as a doctor. Assumption (as in getStaffContext):
// without a clinicId, use their first active doctor membership.
export async function requireDoctorAccess(
  action: Action,
  clinicId?: string,
): Promise<DoctorAccess> {
  if (clinicId !== undefined && !uuidSchema.safeParse(clinicId).success) {
    throw new AppError("FORBIDDEN", "You don't have access to this clinic.");
  }
  const user = await requireSession();
  const membership = await getDb().clinicMembership.findFirst({
    where: {
      userId: user.userId,
      role: "DOCTOR",
      status: "ACTIVE",
      ...(clinicId ? { clinicId } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: {
      clinic: { select: { id: true, name: true, timezone: true } },
    },
  });
  if (!membership) {
    throw new AppError("FORBIDDEN", "Only doctors can use the doctor panel.");
  }
  // Re-checks clinic, user and membership status like every other staff call.
  const access = await requireClinicPermission(membership.clinic.id, action);
  return { ...access, clinic: membership.clinic };
}
