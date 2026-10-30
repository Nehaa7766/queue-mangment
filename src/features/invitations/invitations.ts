import { recordAudit } from "@/features/audit/record-audit";
import { requireClinicAdminAccess } from "@/features/clinics/access";
import { enqueueOutboxEvent } from "@/features/notifications/events";
import {
  hashStaffPassword,
  saveCredentialPassword,
} from "@/features/staff/passwords";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors/app-error";
import type {
  AcceptInvitationInput,
  InvitationInput,
  InvitationLookup,
  PendingInvitationView,
} from "./schemas";
import {
  hashInvitationToken,
  invitationExpiry,
  newInvitationToken,
} from "./tokens";

export {
  acceptInvitationSchema,
  invitationInputSchema,
  type AcceptInvitationInput,
  type InvitationInput,
  type InvitationLookup,
  type PendingInvitationView,
} from "./schemas";

// Staff invitations (docs/PHASES.md Phase 7). The email goes out through the
// outbox (Phase 8); the admin also gets the link to copy, so inviting works
// before email is set up.

export function acceptUrl(token: string): string {
  return new URL(
    `/accept-invite/${token}`,
    getEnv().BETTER_AUTH_URL,
  ).toString();
}

export async function listPendingInvitations(
  clinicId: string,
  now: Date = new Date(),
): Promise<PendingInvitationView[]> {
  await requireClinicAdminAccess(clinicId, "staff.manage");
  const rows = await getDb().staffInvitation.findMany({
    where: { clinicId, acceptedAt: null, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, role: true, expiresAt: true },
  });
  return rows.map((row) => ({
    ...row,
    expiresAt: row.expiresAt.toISOString(),
    expired: row.expiresAt <= now,
  }));
}

export async function createInvitation(
  clinicId: string,
  input: InvitationInput,
): Promise<{ invitation: PendingInvitationView; acceptUrl: string }> {
  const access = await requireClinicAdminAccess(clinicId, "staff.manage");
  const db = getDb();

  const existing = await db.clinicMembership.findFirst({
    where: { clinicId, status: "ACTIVE", user: { email: input.email } },
    select: { id: true },
  });
  if (existing) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Someone with this email already works at this clinic.",
    );
  }

  const token = newInvitationToken();
  const link = acceptUrl(token);
  const expiresAt = invitationExpiry();

  const invitation = await db.$transaction(async (tx) => {
    const clinic = await tx.clinic.findUniqueOrThrow({
      where: { id: clinicId },
      select: { name: true },
    });
    // Only the newest link for an email works.
    await tx.staffInvitation.updateMany({
      where: {
        clinicId,
        email: input.email,
        acceptedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    const created = await tx.staffInvitation.create({
      data: {
        clinicId,
        email: input.email,
        name: input.name,
        role: input.role,
        tokenHash: hashInvitationToken(token),
        invitedByUserId: access.user.userId,
        expiresAt,
      },
      select: { id: true, name: true, email: true, role: true },
    });
    await enqueueOutboxEvent(tx, "staff.invited", created.id, {
      invitationId: created.id,
      email: created.email,
      name: created.name,
      clinicName: clinic.name,
      role: created.role,
      acceptUrl: link,
      expiresAt: expiresAt.toISOString(),
    });
    await recordAudit(tx, {
      clinicId,
      actorUserId: access.user.userId,
      action: "staff.invited",
      newState: created.role,
      metadata: { invitationId: created.id },
    });
    return created;
  });

  return {
    invitation: {
      ...invitation,
      expiresAt: expiresAt.toISOString(),
      expired: false,
    },
    acceptUrl: link,
  };
}

export async function revokeInvitation(
  clinicId: string,
  invitationId: string,
): Promise<void> {
  const db = getDb();
  const invitation = await db.staffInvitation.findUnique({
    where: { id: invitationId },
    select: { id: true, clinicId: true, acceptedAt: true, revokedAt: true },
  });
  if (!invitation || invitation.clinicId !== clinicId) {
    throw new AppError("VALIDATION_ERROR", "This invitation wasn't found.");
  }
  const access = await requireClinicAdminAccess(
    invitation.clinicId,
    "staff.manage",
  );
  if (invitation.acceptedAt) {
    throw new AppError(
      "VALIDATION_ERROR",
      "This invitation was already accepted.",
    );
  }
  if (invitation.revokedAt) return;
  await db.$transaction(async (tx) => {
    await tx.staffInvitation.update({
      where: { id: invitation.id },
      data: { revokedAt: new Date() },
    });
    await recordAudit(tx, {
      clinicId: invitation.clinicId,
      actorUserId: access.user.userId,
      action: "staff.invitation_revoked",
      metadata: { invitationId: invitation.id },
    });
  });
}

// ---- Accepting (public: the link is the credential) ----

export async function lookupInvitation(
  token: string,
  now: Date = new Date(),
): Promise<InvitationLookup> {
  const db = getDb();
  const invitation = await db.staffInvitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    select: {
      name: true,
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      clinic: { select: { name: true, status: true } },
    },
  });
  if (!invitation || invitation.revokedAt) return { status: "invalid" };
  if (invitation.clinic.status !== "ACTIVE") return { status: "invalid" };
  if (invitation.acceptedAt) return { status: "used" };
  if (invitation.expiresAt <= now) return { status: "expired" };
  const user = await db.user.findUnique({
    where: { email: invitation.email },
    select: { id: true },
  });
  return {
    status: "valid",
    clinicName: invitation.clinic.name,
    name: invitation.name,
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expiresAt.toISOString(),
    hasAccount: user !== null,
  };
}

const LINK_PROBLEMS = {
  invalid:
    "This invitation link isn't valid. Ask your clinic admin for a new one.",
  expired: "This invitation has expired. Ask your clinic admin for a new one.",
  used: "This invitation was already used. Sign in instead.",
} as const;

// Creates the account (for a new person) and the clinic membership in one
// transaction. The invitation is claimed first, so two clicks can't both win.
export async function acceptInvitation(
  token: string,
  input: AcceptInvitationInput,
  now: Date = new Date(),
): Promise<{ email: string; hasAccount: boolean }> {
  const lookup = await lookupInvitation(token, now);
  if (lookup.status !== "valid") {
    throw new AppError("VALIDATION_ERROR", LINK_PROBLEMS[lookup.status]);
  }
  if (!lookup.hasAccount && !input.password) {
    throw new AppError("VALIDATION_ERROR", "Choose a password.");
  }
  const passwordHash =
    !lookup.hasAccount && input.password
      ? await hashStaffPassword(input.password)
      : null;
  const tokenHash = hashInvitationToken(token);

  return getDb().$transaction(async (tx) => {
    const claimed = await tx.staffInvitation.updateMany({
      where: {
        tokenHash,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { acceptedAt: now },
    });
    if (claimed.count === 0) {
      throw new AppError("VALIDATION_ERROR", LINK_PROBLEMS.used);
    }
    const invitation = await tx.staffInvitation.findUniqueOrThrow({
      where: { tokenHash },
      select: { id: true, clinicId: true, email: true, role: true },
    });

    let user = await tx.user.findUnique({
      where: { email: invitation.email },
      select: { id: true, status: true },
    });
    if (user && user.status !== "ACTIVE") {
      throw new AppError(
        "FORBIDDEN",
        "This account is switched off. Ask your clinic admin for help.",
      );
    }
    if (!user) {
      user = await tx.user.create({
        data: { name: input.name, email: invitation.email },
        select: { id: true, status: true },
      });
    }
    if (passwordHash) {
      await saveCredentialPassword(tx, user.id, passwordHash);
    }

    await tx.clinicMembership.upsert({
      where: {
        clinicId_userId: { clinicId: invitation.clinicId, userId: user.id },
      },
      create: {
        clinicId: invitation.clinicId,
        userId: user.id,
        role: invitation.role,
        status: "ACTIVE",
      },
      update: { role: invitation.role, status: "ACTIVE" },
    });
    await recordAudit(tx, {
      clinicId: invitation.clinicId,
      actorUserId: user.id,
      action: "staff.invitation_accepted",
      newState: invitation.role,
      metadata: { invitationId: invitation.id },
    });
    return { email: invitation.email, hasAccount: lookup.hasAccount };
  });
}
