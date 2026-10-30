import { z } from "zod";
import type {
  MembershipRole,
  PlatformRole,
  UserStatus,
} from "@/generated/prisma/enums";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { recordPlatformAudit } from "./audit";

const LIST_LIMIT = 100;

export type UserRow = {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  platformRole: PlatformRole | null;
  createdAt: string;
  memberships: { clinicName: string; role: MembershipRole }[];
};

// There is no generic NOT_FOUND code yet (src/lib/errors/app-error.ts).
function userNotFound(): AppError {
  return new AppError("VALIDATION_ERROR", "This user could not be found.");
}

export async function listUsers(filters: {
  search?: string;
}): Promise<UserRow[]> {
  await requirePlatformAdmin();
  const search = filters.search?.trim();
  const users = await getDb().user.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: LIST_LIMIT,
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      platformRole: true,
      createdAt: true,
      memberships: {
        select: { role: true, clinic: { select: { name: true } } },
      },
    },
  });
  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    platformRole: user.platformRole,
    createdAt: user.createdAt.toISOString(),
    memberships: user.memberships.map((m) => ({
      clinicName: m.clinic.name,
      role: m.role,
    })),
  }));
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
      select: { status: true },
    });
    if (!user) throw userNotFound();
    if (user.status === status) return;
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
