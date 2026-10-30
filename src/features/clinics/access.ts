import { requireClinicPermission, type ClinicAccess } from "@/lib/auth/guards";
import type { Action } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";

export function clinicNotFound(): AppError {
  return new AppError("CLINIC_NOT_FOUND", "This clinic could not be found.");
}

// Admin features load the clinic first, then authorize against it, so an
// unknown clinic is a 404 and someone else's clinic is a 403.
export async function requireClinicAdminAccess(
  clinicId: string,
  action: Action,
): Promise<ClinicAccess> {
  const clinic = await getDb().clinic.findUnique({
    where: { id: clinicId },
    select: { id: true },
  });
  if (!clinic) throw clinicNotFound();
  return requireClinicPermission(clinic.id, action);
}
