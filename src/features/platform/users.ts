import { z } from "zod";
import { describeAction } from "@/features/analytics/audit-log";
import { recordAudit } from "@/features/audit/record-audit";
import { acceptUrl } from "@/features/invitations/invitations";
import {
  hashInvitationToken,
  invitationExpiry,
  newInvitationToken,
} from "@/features/invitations/tokens";
import { enqueueOutboxEvent } from "@/features/notifications/events";
import { Prisma } from "@/generated/prisma/client";
import type {
  MembershipRole,
  MembershipStatus,
  UserStatus,
} from "@/generated/prisma/enums";
import { getAuth } from "@/lib/auth/auth";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { logError } from "@/lib/log";
import { actionLabel, listPlatformActivity } from "./activity";
import { recordPlatformAudit } from "./audit";
import { PAGE_SIZE, pageWindow, type Paginated } from "./pagination";
import { clinicNotFound } from "./clinics";
import type { AdminCreateInput, UserInput, UserTab } from "./schemas";

// QueueCare has exactly one global super admin. It adds clinic admins, and
// each clinic admin adds their own staff from the clinic's Staff page. No
// code path here creates another super admin or changes `platformRole`.

export type UserMembership = {
  clinicId: string;
  clinicName: string;
  role: MembershipRole;
  status: MembershipStatus;
};

export type UserRow = {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  createdAt: string;
  memberships: UserMembership[];
  isSelf: boolean;
  // Why the user can't be deleted, or null when they can.
  deleteBlocker: string | null;
};

// One page of a tab, plus how many people each tab holds.
export type UserList = Paginated<UserRow> & {
  counts: Record<UserTab, number>;
};

const STAFF_ROLES = [
  "RECEPTIONIST",
  "DOCTOR",
] as const satisfies readonly MembershipRole[];

// Which memberships each tab is about.
export const TAB_ROLES: Record<UserTab, readonly MembershipRole[]> = {
  admins: ["CLINIC_ADMIN"],
  staff: STAFF_ROLES,
};

const EMAIL_TAKEN = "Another account already uses this email.";
const SUPER_ADMIN_FIXED =
  "The super admin account can't be deactivated or deleted.";
const ALREADY_MEMBER = "This person already has access to this clinic.";

// There is no generic NOT_FOUND code yet (src/lib/errors/app-error.ts).
function userNotFound(): AppError {
  return new AppError("VALIDATION_ERROR", "This user could not be found.");
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

type DeleteFacts = {
  isSelf: boolean;
  isSuperAdmin: boolean;
  memberships: number;
  // Tokens they created or served, and clinic audit entries they made.
  historyCount: number;
};

// A user is deleted only when nothing points at them; anyone with clinic
// access or history is deactivated instead, so the record stays truthful.
export function userDeleteBlocker(facts: DeleteFacts): string | null {
  if (facts.isSelf) return "You can't delete your own account.";
  if (facts.isSuperAdmin) return SUPER_ADMIN_FIXED;
  if (facts.memberships > 0 || facts.historyCount > 0) {
    return "Has clinic access or history. Deactivate instead.";
  }
  return null;
}

const deleteCountsSelect = {
  memberships: true,
  createdTokens: true,
  assignedTokens: true,
  auditEvents: true,
} as const;

function historyCount(counts: {
  createdTokens: number;
  assignedTokens: number;
  auditEvents: number;
}): number {
  return counts.createdTokens + counts.assignedTokens + counts.auditEvents;
}

function tabWhere(tab: UserTab): Prisma.UserWhereInput {
  if (tab === "admins") {
    return { memberships: { some: { role: "CLINIC_ADMIN" } } };
  }
  // Former staff left with no clinic (e.g. after a clinic was deleted) are
  // listed with the staff, so they can still be found and removed.
  return {
    OR: [
      { memberships: { some: { role: { in: [...STAFF_ROLES] } } } },
      { memberships: { none: {} } },
    ],
  };
}

function searchWhere(search: string): Prisma.UserWhereInput {
  return {
    OR: [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ],
  };
}

function listWhere(
  tab: UserTab,
  search: string | undefined,
  status: UserStatus | undefined,
): Prisma.UserWhereInput {
  return {
    // The super admin is shown on its own, never in a tab.
    platformRole: null,
    ...(status && { status }),
    AND: [tabWhere(tab), ...(search ? [searchWhere(search)] : [])],
  };
}

// One tab of the Users page, plus how many people each tab holds with the
// same search and status filter. Someone who is an admin at one clinic and
// staff at another appears in both tabs.
export async function listUsers(filters: {
  tab: UserTab;
  search?: string;
  status?: UserStatus;
  page?: number;
  pageSize?: number;
}): Promise<UserList> {
  const admin = await requirePlatformAdmin();
  const search = filters.search?.trim() || undefined;
  const pageSize = filters.pageSize ?? PAGE_SIZE;
  const db = getDb();
  const [admins, staff] = await Promise.all([
    db.user.count({ where: listWhere("admins", search, filters.status) }),
    db.user.count({ where: listWhere("staff", search, filters.status) }),
  ]);
  const counts = { admins, staff };
  const total = counts[filters.tab];
  const { page, pageCount, skip } = pageWindow(
    filters.page ?? 1,
    total,
    pageSize,
  );
  const users = await db.user.findMany({
    where: listWhere(filters.tab, search, filters.status),
    // Newest first; the id breaks ties, so pages never repeat a row.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip,
    take: pageSize,
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      createdAt: true,
      memberships: {
        orderBy: { createdAt: "asc" },
        select: {
          role: true,
          status: true,
          clinic: { select: { id: true, name: true } },
        },
      },
      _count: { select: deleteCountsSelect },
    },
  });
  return {
    rows: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
      memberships: user.memberships.map((m) => ({
        clinicId: m.clinic.id,
        clinicName: m.clinic.name,
        role: m.role,
        status: m.status,
      })),
      isSelf: user.id === admin.userId,
      deleteBlocker: userDeleteBlocker({
        isSelf: user.id === admin.userId,
        isSuperAdmin: false,
        memberships: user._count.memberships,
        historyCount: historyCount(user._count),
      }),
    })),
    counts,
    total,
    page,
    pageCount,
    pageSize,
  };
}

// What a user did, newest first, for their detail page.
const RECENT_ACTIONS = 20;

export type UserAction = {
  id: string;
  // "Clinic admin invited", "Token called", …
  label: string;
  // The clinic it happened in, or what a platform action was about.
  context: string | null;
  href: string | null;
  createdAt: string;
};

export type UserDetail = Omit<UserRow, "memberships"> & {
  isSuperAdmin: boolean;
  // When their newest session began. Signing out ends a session, so this
  // can be empty for someone who has signed in before.
  lastSignInAt: string | null;
  memberships: (UserMembership & { since: string })[];
  recentActions: UserAction[];
};

// One user's profile, clinic access and recent actions. Clinic actions are
// shown by name and clinic only: no token, queue or patient details.
export async function getUserDetail(
  userId: string,
): Promise<UserDetail | null> {
  const admin = await requirePlatformAdmin();
  if (!z.uuid().safeParse(userId).success) return null;
  const db = getDb();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      platformRole: true,
      createdAt: true,
      memberships: {
        orderBy: { createdAt: "asc" },
        select: {
          role: true,
          status: true,
          createdAt: true,
          clinic: { select: { id: true, name: true } },
        },
      },
      sessions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
      _count: { select: deleteCountsSelect },
    },
  });
  if (!user) return null;

  const [platformActions, clinicActions] = await Promise.all([
    listPlatformActivity({ limit: RECENT_ACTIONS, actorUserId: user.id }),
    db.auditEvent.findMany({
      where: { actorUserId: user.id },
      orderBy: { createdAt: "desc" },
      take: RECENT_ACTIONS,
      select: {
        id: true,
        action: true,
        createdAt: true,
        clinic: { select: { id: true, name: true } },
      },
    }),
  ]);
  const recentActions: UserAction[] = [
    ...platformActions.map((event) => ({
      id: event.id,
      label: actionLabel(event.action),
      context: event.target.label,
      href: event.target.href,
      createdAt: event.createdAt,
    })),
    ...clinicActions.map((event) => ({
      id: event.id,
      label: describeAction(event.action),
      context: event.clinic.name,
      href: `/super-admin/clinics/${event.clinic.id}`,
      createdAt: event.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, RECENT_ACTIONS);

  const isSelf = user.id === admin.userId;
  const isSuperAdmin = user.platformRole === "SUPER_ADMIN";
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    isSelf,
    isSuperAdmin,
    lastSignInAt: user.sessions[0]?.createdAt.toISOString() ?? null,
    memberships: user.memberships.map((m) => ({
      clinicId: m.clinic.id,
      clinicName: m.clinic.name,
      role: m.role,
      status: m.status,
      since: m.createdAt.toISOString(),
    })),
    deleteBlocker: userDeleteBlocker({
      isSelf,
      isSuperAdmin,
      memberships: user._count.memberships,
      historyCount: historyCount(user._count),
    }),
    recentActions,
  };
}

export type AdminCreateResult =
  | { kind: "invited"; email: string; clinicName: string; acceptUrl: string }
  | { kind: "added"; email: string; clinicName: string; userId: string };

// Adds a clinic admin. A new email gets an invitation (only the token's hash
// is stored; the link is emailed and shown once). An existing account joins
// the clinic as an admin straight away. A clinic may have several admins.
export async function addClinicAdmin(
  input: AdminCreateInput,
  now: Date = new Date(),
): Promise<AdminCreateResult> {
  const admin = await requirePlatformAdmin();
  const token = newInvitationToken();
  const link = acceptUrl(token);
  const expiresAt = invitationExpiry(now);

  try {
    return await getDb().$transaction(async (tx) => {
      const clinic = await tx.clinic.findUnique({
        where: { id: input.clinicId },
        select: { id: true, name: true },
      });
      if (!clinic) throw clinicNotFound();

      const existing = await tx.user.findUnique({
        where: { email: input.email },
        select: {
          id: true,
          status: true,
          platformRole: true,
          memberships: {
            where: { clinicId: clinic.id },
            select: { id: true },
          },
        },
      });
      if (existing) {
        if (existing.platformRole === "SUPER_ADMIN") {
          throw new AppError(
            "VALIDATION_ERROR",
            "That's the super admin account. Use a different email for the clinic admin.",
          );
        }
        if (existing.memberships.length > 0) {
          throw new AppError("VALIDATION_ERROR", ALREADY_MEMBER);
        }
        if (existing.status !== "ACTIVE") {
          throw new AppError(
            "INVALID_STATE_TRANSITION",
            "This account is deactivated. Reactivate it first.",
          );
        }
        await tx.clinicMembership.create({
          data: {
            clinicId: clinic.id,
            userId: existing.id,
            role: "CLINIC_ADMIN",
          },
        });
        await recordPlatformAudit(tx, {
          actorUserId: admin.userId,
          action: "admin.added",
          targetType: "user",
          targetId: existing.id,
          metadata: { clinicId: clinic.id, clinicName: clinic.name },
        });
        return {
          kind: "added",
          email: input.email,
          clinicName: clinic.name,
          userId: existing.id,
        };
      }

      // Only the newest link for an email works.
      await tx.staffInvitation.updateMany({
        where: {
          clinicId: clinic.id,
          email: input.email,
          acceptedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: now },
      });
      const invitation = await tx.staffInvitation.create({
        data: {
          clinicId: clinic.id,
          email: input.email,
          name: input.name,
          role: "CLINIC_ADMIN",
          tokenHash: hashInvitationToken(token),
          invitedByUserId: admin.userId,
          expiresAt,
        },
        select: { id: true },
      });
      await enqueueOutboxEvent(tx, "staff.invited", invitation.id, {
        invitationId: invitation.id,
        email: input.email,
        name: input.name,
        clinicName: clinic.name,
        role: "CLINIC_ADMIN",
        acceptUrl: link,
        expiresAt: expiresAt.toISOString(),
      });
      await recordAudit(tx, {
        clinicId: clinic.id,
        actorUserId: admin.userId,
        action: "staff.invited",
        newState: "CLINIC_ADMIN",
        metadata: { invitationId: invitation.id },
      });
      await recordPlatformAudit(tx, {
        actorUserId: admin.userId,
        action: "admin.invited",
        targetType: "clinic",
        targetId: clinic.id,
        metadata: { email: input.email, invitationId: invitation.id },
      });
      return {
        kind: "invited",
        email: input.email,
        clinicName: clinic.name,
        acceptUrl: link,
      };
    });
  } catch (error) {
    // Two requests adding the same person to the same clinic at once.
    if (isUniqueViolation(error)) {
      throw new AppError("VALIDATION_ERROR", ALREADY_MEMBER);
    }
    throw error;
  }
}

// Deactivating signs the user out everywhere and blocks new sessions
// (see the session hook in src/lib/auth/auth.ts).
export async function setUserStatus(
  userId: string,
  status: UserStatus,
): Promise<void> {
  const admin = await requirePlatformAdmin();
  if (!z.uuid().safeParse(userId).success) throw userNotFound();
  if (userId === admin.userId && status === "INACTIVE") {
    throw new AppError(
      "VALIDATION_ERROR",
      "You can't deactivate your own account.",
    );
  }
  await getDb().$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { status: true, platformRole: true },
    });
    if (!user) throw userNotFound();
    if (user.status === status) return;
    if (status === "INACTIVE" && user.platformRole === "SUPER_ADMIN") {
      throw new AppError("INVALID_STATE_TRANSITION", SUPER_ADMIN_FIXED);
    }
    await tx.user.update({ where: { id: userId }, data: { status } });
    if (status === "INACTIVE") {
      await tx.session.deleteMany({ where: { userId } });
    }
    await recordPlatformAudit(tx, {
      actorUserId: admin.userId,
      action: status === "ACTIVE" ? "user.reactivated" : "user.deactivated",
      targetType: "user",
      targetId: userId,
      metadata: { previousStatus: user.status, newStatus: status },
    });
  });
}

// Better Auth's own reset flow: it records the email in the outbox, and the
// link lets the person choose a password (src/features/notifications).
// Returns false if the email couldn't be queued; the account still stands.
async function queueSetPasswordEmail(email: string): Promise<boolean> {
  try {
    await getAuth().api.requestPasswordReset({ body: { email } });
    return true;
  } catch (error) {
    logError("Could not queue a password email", {
      requestId: "platform-users",
      error,
    });
    return false;
  }
}

export async function updateUser(
  userId: string,
  input: UserInput,
): Promise<void> {
  const admin = await requirePlatformAdmin();
  if (!z.uuid().safeParse(userId).success) throw userNotFound();
  try {
    await getDb().$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });
      if (!user) throw userNotFound();
      const changed = (["name", "email"] as const).filter(
        (field) => user[field] !== input[field],
      );
      if (changed.length === 0) return;
      if (changed.includes("email")) {
        const taken = await tx.user.findUnique({
          where: { email: input.email },
          select: { id: true },
        });
        if (taken) throw new AppError("VALIDATION_ERROR", EMAIL_TAKEN);
      }
      await tx.user.update({
        where: { id: userId },
        // A new address hasn't been confirmed by its owner.
        data: {
          name: input.name,
          email: input.email,
          ...(changed.includes("email") && { emailVerified: false }),
        },
      });
      await recordPlatformAudit(tx, {
        actorUserId: admin.userId,
        action: "user.updated",
        targetType: "user",
        targetId: userId,
        metadata: { changed },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("VALIDATION_ERROR", EMAIL_TAKEN);
    }
    throw error;
  }
}

export async function sendUserPasswordReset(userId: string): Promise<void> {
  const admin = await requirePlatformAdmin();
  if (!z.uuid().safeParse(userId).success) throw userNotFound();
  const db = getDb();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, status: true },
  });
  if (!user) throw userNotFound();
  if (user.status !== "ACTIVE") {
    throw new AppError(
      "INVALID_STATE_TRANSITION",
      "Reactivate this user before sending a reset link.",
    );
  }
  if (!(await queueSetPasswordEmail(user.email))) {
    throw new AppError(
      "INTERNAL_ERROR",
      "The reset email couldn't be queued. Please try again.",
    );
  }
  await db.$transaction(async (tx) => {
    await recordPlatformAudit(tx, {
      actorUserId: admin.userId,
      action: "user.password_reset_sent",
      targetType: "user",
      targetId: userId,
    });
  });
}

// Sessions and sign-in accounts go with the user (cascade).
export async function deleteUser(userId: string): Promise<void> {
  const admin = await requirePlatformAdmin();
  if (!z.uuid().safeParse(userId).success) throw userNotFound();
  await getDb().$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        platformRole: true,
        _count: { select: deleteCountsSelect },
      },
    });
    if (!user) throw userNotFound();
    const blocker = userDeleteBlocker({
      isSelf: userId === admin.userId,
      isSuperAdmin: user.platformRole === "SUPER_ADMIN",
      memberships: user._count.memberships,
      historyCount: historyCount(user._count),
    });
    if (blocker) {
      throw new AppError(
        userId === admin.userId
          ? "VALIDATION_ERROR"
          : "INVALID_STATE_TRANSITION",
        blocker,
      );
    }
    await tx.user.delete({ where: { id: userId } });
    await recordPlatformAudit(tx, {
      actorUserId: admin.userId,
      action: "user.deleted",
      targetType: "user",
      targetId: userId,
      metadata: { email: user.email },
    });
  });
}
