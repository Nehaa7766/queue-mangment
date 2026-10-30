import type { Prisma } from "@/generated/prisma/client";
import { recordAudit } from "@/features/audit/record-audit";
import { requireClinicAdminAccess } from "@/features/clinics/access";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { hashStaffPassword, saveCredentialPassword } from "./passwords";
import type { MemberUpdate, StaffMemberView } from "./schemas";

export {
  doctorServicesSchema,
  MEMBERSHIP_ROLES,
  memberUpdateSchema,
  passwordResetSchema,
  type MemberUpdate,
  type StaffMemberView,
} from "./schemas";

// Staff management for clinic admins (docs/PHASES.md Phase 7). Every change
// is checked against the member's clinic and audited.

export async function listStaff(clinicId: string): Promise<StaffMemberView[]> {
  const access = await requireClinicAdminAccess(clinicId, "staff.manage");
  const members = await getDb().clinicMembership.findMany({
    where: { clinicId },
    orderBy: [{ status: "asc" }, { role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      role: true,
      status: true,
      availability: true,
      delayMinutes: true,
      user: { select: { id: true, name: true, email: true } },
      serviceAssignments: { select: { serviceId: true } },
    },
  });
  return members.map((member) => ({
    membershipId: member.id,
    userId: member.user.id,
    name: member.user.name,
    email: member.user.email,
    role: member.role,
    status: member.status,
    isYou: member.user.id === access.user.userId,
    availability: member.availability,
    delayMinutes: member.delayMinutes,
    serviceIds: member.serviceAssignments.map((row) => row.serviceId),
  }));
}

export function memberNotFound(): AppError {
  return new AppError("VALIDATION_ERROR", "This staff member wasn't found.");
}

// The member must belong to the clinic in the request path.
async function loadMember(clinicId: string, membershipId: string) {
  const member = await getDb().clinicMembership.findUnique({
    where: { id: membershipId },
    select: {
      id: true,
      clinicId: true,
      userId: true,
      role: true,
      status: true,
    },
  });
  if (!member || member.clinicId !== clinicId) throw memberNotFound();
  return member;
}

// Role and active status. Admins can't change themselves, so the acting admin
// always remains; the admin count below is a second guard against lock-out.
export async function updateMember(
  clinicId: string,
  membershipId: string,
  update: MemberUpdate,
): Promise<void> {
  const member = await loadMember(clinicId, membershipId);
  const access = await requireClinicAdminAccess(
    member.clinicId,
    "staff.manage",
  );
  if (member.userId === access.user.userId) {
    throw new AppError(
      "FORBIDDEN",
      "You can't change your own role or access. Ask another clinic admin.",
    );
  }

  await getDb().$transaction(async (tx) => {
    const losesAdmin =
      member.role === "CLINIC_ADMIN" &&
      member.status === "ACTIVE" &&
      ((update.role && update.role !== "CLINIC_ADMIN") ||
        update.status === "INACTIVE");
    if (losesAdmin) {
      const otherAdmins = await tx.clinicMembership.count({
        where: {
          clinicId: member.clinicId,
          role: "CLINIC_ADMIN",
          status: "ACTIVE",
          id: { not: member.id },
        },
      });
      if (otherAdmins === 0) {
        throw new AppError(
          "VALIDATION_ERROR",
          "The clinic needs at least one active admin.",
        );
      }
    }

    await tx.clinicMembership.update({
      where: { id: member.id },
      data: update,
    });
    if (update.role && update.role !== member.role) {
      // Service assignments only mean something for doctors.
      if (update.role !== "DOCTOR") {
        await tx.serviceAssignment.deleteMany({
          where: { membershipId: member.id },
        });
      }
      await recordAudit(tx, {
        clinicId: member.clinicId,
        actorUserId: access.user.userId,
        action: "staff.role_changed",
        previousState: member.role,
        newState: update.role,
        metadata: { membershipId: member.id },
      });
    }
    if (update.status && update.status !== member.status) {
      if (update.status === "INACTIVE") {
        await signOutIfNoOtherClinic(tx, member.userId, member.clinicId);
      }
      await recordAudit(tx, {
        clinicId: member.clinicId,
        actorUserId: access.user.userId,
        action:
          update.status === "INACTIVE"
            ? "staff.deactivated"
            : "staff.reactivated",
        previousState: member.status,
        newState: update.status,
        metadata: { membershipId: member.id },
      });
    }
  });
}

// A deactivated member loses access to this clinic straight away. End their
// sessions too, unless they still work at another clinic.
async function signOutIfNoOtherClinic(
  tx: Prisma.TransactionClient,
  userId: string,
  clinicId: string,
): Promise<void> {
  const elsewhere = await tx.clinicMembership.count({
    where: { userId, status: "ACTIVE", clinicId: { not: clinicId } },
  });
  if (elsewhere === 0) {
    await tx.session.deleteMany({ where: { userId } });
  }
}

// Sets a new password for a member who can't sign in. Assumption: one
// QueueCare account per person, so an admin may only reset the password of
// someone who works at their clinic alone.
export async function resetMemberPassword(
  clinicId: string,
  membershipId: string,
  password: string,
): Promise<void> {
  const member = await loadMember(clinicId, membershipId);
  const access = await requireClinicAdminAccess(
    member.clinicId,
    "staff.manage",
  );
  if (member.userId === access.user.userId) {
    throw new AppError(
      "FORBIDDEN",
      "Change your own password from your account, not from staff management.",
    );
  }
  const db = getDb();
  const elsewhere = await db.clinicMembership.count({
    where: { userId: member.userId, clinicId: { not: member.clinicId } },
  });
  if (elsewhere > 0) {
    throw new AppError(
      "FORBIDDEN",
      "This person also works at another clinic. Ask them to reset their own password.",
    );
  }

  const passwordHash = await hashStaffPassword(password);
  await db.$transaction(async (tx) => {
    await saveCredentialPassword(tx, member.userId, passwordHash);
    // Old sessions end, so a shared or stolen session stops working.
    await tx.session.deleteMany({ where: { userId: member.userId } });
    await recordAudit(tx, {
      clinicId: member.clinicId,
      actorUserId: access.user.userId,
      action: "staff.password_reset",
      metadata: { membershipId: member.id },
    });
  });
}

// Which services a doctor serves. An empty list means every service
// (assumption in prisma/schema.prisma, ServiceAssignment).
export async function setDoctorServices(
  clinicId: string,
  membershipId: string,
  serviceIds: readonly string[],
): Promise<void> {
  const member = await loadMember(clinicId, membershipId);
  const access = await requireClinicAdminAccess(
    member.clinicId,
    "services.manage",
  );
  if (member.role !== "DOCTOR") {
    throw new AppError(
      "VALIDATION_ERROR",
      "Only doctors can be assigned to services.",
    );
  }
  const unique = [...new Set(serviceIds)];
  await getDb().$transaction(async (tx) => {
    const services = await tx.service.count({
      where: { id: { in: unique }, clinicId: member.clinicId },
    });
    if (services !== unique.length) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Choose services from this clinic.",
      );
    }
    await tx.serviceAssignment.deleteMany({
      where: { membershipId: member.id },
    });
    if (unique.length > 0) {
      await tx.serviceAssignment.createMany({
        data: unique.map((serviceId) => ({
          membershipId: member.id,
          serviceId,
        })),
      });
    }
    await recordAudit(tx, {
      clinicId: member.clinicId,
      actorUserId: access.user.userId,
      action: "staff.doctor_services_updated",
      metadata: { membershipId: member.id, serviceIds: unique },
    });
  });
}
