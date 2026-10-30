import type { MembershipRole } from "@/generated/prisma/enums";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { can, type Action } from "./permissions";
import { getSessionUser, type SessionUser } from "./session";

export type ClinicAccess = {
  user: SessionUser;
  clinicId: string;
  membershipId: string;
  role: MembershipRole;
};

const NO_CLINIC_ACCESS = "You don't have access to this clinic.";

export async function requireSession(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new AppError("UNAUTHENTICATED", "Please sign in to continue.");
  }
  return user;
}

export async function requirePlatformAdmin(): Promise<SessionUser> {
  const user = await requireSession();
  if (user.platformRole !== "SUPER_ADMIN") {
    throw new AppError("FORBIDDEN", "You don't have access to this page.");
  }
  return user;
}

// Pass the clinicId of a resource you have already loaded, never one taken
// from the request: load the queue or token first, then authorize against
// its clinic.
export async function requireClinicRole(
  clinicId: string,
  roles: readonly MembershipRole[],
): Promise<ClinicAccess> {
  const access = await loadClinicAccess(clinicId);
  if (!roles.includes(access.role)) {
    throw new AppError("FORBIDDEN", NO_CLINIC_ACCESS);
  }
  return access;
}

// Same as requireClinicRole, but checks the permission matrix instead of a
// role list, so handlers name the action rather than the roles.
export async function requireClinicPermission(
  clinicId: string,
  action: Action,
): Promise<ClinicAccess> {
  const access = await loadClinicAccess(clinicId);
  if (!can(access.role, action)) {
    throw new AppError("FORBIDDEN", NO_CLINIC_ACCESS);
  }
  return access;
}

// Use when a second resource is loaded after access was granted, e.g. a
// token ID from the request body inside an already-authorized queue action.
export function assertSameClinic(
  resourceClinicId: string,
  access: Pick<ClinicAccess, "clinicId">,
): void {
  if (resourceClinicId !== access.clinicId) {
    throw new AppError("FORBIDDEN", NO_CLINIC_ACCESS);
  }
}

async function loadClinicAccess(clinicId: string): Promise<ClinicAccess> {
  const user = await requireSession();
  const membership = await getDb().clinicMembership.findUnique({
    where: { clinicId_userId: { clinicId, userId: user.userId } },
    select: {
      id: true,
      role: true,
      status: true,
      user: { select: { status: true } },
      clinic: { select: { status: true } },
    },
  });
  if (
    !membership ||
    membership.status !== "ACTIVE" ||
    membership.user.status !== "ACTIVE" ||
    membership.clinic.status !== "ACTIVE"
  ) {
    throw new AppError("FORBIDDEN", NO_CLINIC_ACCESS);
  }
  return {
    user,
    clinicId,
    membershipId: membership.id,
    role: membership.role,
  };
}
