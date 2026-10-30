import { vi } from "vitest";
import type { PlatformRole } from "@/generated/prisma/enums";
import { getSessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";

// Test files must call vi.mock("@/lib/auth/session", ...) themselves (vi.mock
// is hoisted per file); actAs() then switches the signed-in user.
export function actAs(
  user: { id: string } | null,
  platformRole: PlatformRole | null = null,
): void {
  vi.mocked(getSessionUser).mockResolvedValue(
    user ? { userId: user.id, platformRole } : null,
  );
}

// Everything a test creates, so cleanup removes only its own rows. The test
// database is shared with other test files and parallel runs.
export type Created = {
  clinicIds: string[];
  userIds: string[];
  ticketIds: string[];
};

export function createdTracker(): Created {
  return { clinicIds: [], userIds: [], ticketIds: [] };
}

export async function createUser(
  created: Created,
  label: string,
  platformRole: PlatformRole | null = null,
) {
  const run = crypto.randomUUID().slice(0, 8);
  const user = await getDb().user.create({
    data: {
      name: `${label} ${run}`,
      email: `${label}-${run}@example.test`,
      platformRole,
    },
  });
  created.userIds.push(user.id);
  return user;
}

export async function createActiveClinic(created: Created) {
  const db = getDb();
  const run = crypto.randomUUID().slice(0, 8);
  const clinic = await db.clinic.create({
    data: { name: `Platform Test ${run}`, slug: `platform-test-${run}` },
  });
  created.clinicIds.push(clinic.id);
  const staff = await createUser(created, "staff");
  await db.clinicMembership.create({
    data: { clinicId: clinic.id, userId: staff.id, role: "CLINIC_ADMIN" },
  });
  return { clinic, staff };
}

export async function cleanUp(created: Created): Promise<void> {
  const db = getDb();
  const { clinicIds, userIds, ticketIds } = created;
  await db.platformAuditEvent.deleteMany({
    where: {
      OR: [
        { targetId: { in: [...clinicIds, ...userIds, ...ticketIds] } },
        { actorUserId: { in: userIds } },
      ],
    },
  });
  await db.supportTicket.deleteMany({
    where: {
      OR: [{ id: { in: ticketIds } }, { clinicId: { in: clinicIds } }],
    },
  });
  // Subscriptions, holidays and invitations cascade with the clinic.
  await db.clinicMembership.deleteMany({
    where: {
      OR: [{ clinicId: { in: clinicIds } }, { userId: { in: userIds } }],
    },
  });
  await db.service.deleteMany({ where: { clinicId: { in: clinicIds } } });
  await db.clinic.deleteMany({ where: { id: { in: clinicIds } } });
  // Sessions and accounts cascade with the user.
  await db.user.deleteMany({ where: { id: { in: userIds } } });
}
