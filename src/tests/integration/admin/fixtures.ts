import { vi } from "vitest";
import type { MembershipRole } from "@/generated/prisma/enums";
import { getOrCreateTodayQueue } from "@/features/queue/service";
import { getSessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";

// Test files must call vi.mock("@/lib/auth/session", ...) themselves (vi.mock
// is hoisted per file); actAs() then switches the signed-in user.
export function actAs(user: { id: string } | null): void {
  vi.mocked(getSessionUser).mockResolvedValue(
    user ? { userId: user.id, platformRole: null } : null,
  );
}

export type AdminFixture = Awaited<ReturnType<typeof createAdminFixture>>;

// A clinic with an admin, a receptionist, a doctor and one service with
// today's queue. Names carry a unique suffix: test runs share the database.
export async function createAdminFixture() {
  const db = getDb();
  const run = crypto.randomUUID().slice(0, 8);
  const clinic = await db.clinic.create({
    data: { name: `Admin Test ${run}`, slug: `admin-test-${run}` },
  });
  const service = await db.service.create({
    data: { clinicId: clinic.id, name: "General", tokenPrefix: "A" },
  });

  const addStaff = async (role: MembershipRole, label: string) => {
    const user = await db.user.create({
      data: { name: `${label} ${run}`, email: `${label}-${run}@example.test` },
    });
    const membership = await db.clinicMembership.create({
      data: { clinicId: clinic.id, userId: user.id, role },
    });
    return { id: user.id, membershipId: membership.id, email: user.email };
  };
  const admin = await addStaff("CLINIC_ADMIN", "admin");
  const receptionist = await addStaff("RECEPTIONIST", "reception");
  const doctor = await addStaff("DOCTOR", "doctor");
  const queue = await getOrCreateTodayQueue(service.id);

  return { run, clinic, service, queue, admin, receptionist, doctor };
}

export async function deleteAdminFixtures(
  fixtures: readonly (AdminFixture | undefined)[],
): Promise<void> {
  const db = getDb();
  const clinicIds = fixtures.flatMap((fixture) =>
    fixture ? [fixture.clinic.id] : [],
  );
  if (clinicIds.length === 0) return;

  const [memberships, invitations, queues] = await Promise.all([
    db.clinicMembership.findMany({
      where: { clinicId: { in: clinicIds } },
      select: { userId: true },
    }),
    db.staffInvitation.findMany({
      where: { clinicId: { in: clinicIds } },
      select: { id: true },
    }),
    db.queue.findMany({
      where: { clinicId: { in: clinicIds } },
      select: { id: true },
    }),
  ]);

  await db.outboxEvent.deleteMany({
    where: { aggregateId: { in: invitations.map((row) => row.id) } },
  });
  await db.idempotencyRecord.deleteMany({
    where: {
      OR: queues.map((queue) => ({
        scope: { startsWith: `queue:${queue.id}:` },
      })),
    },
  });
  await db.auditEvent.deleteMany({ where: { clinicId: { in: clinicIds } } });
  await db.staffInvitation.deleteMany({
    where: { clinicId: { in: clinicIds } },
  });
  await db.clinicHoliday.deleteMany({ where: { clinicId: { in: clinicIds } } });
  await db.queueToken.deleteMany({ where: { clinicId: { in: clinicIds } } });
  await db.queue.deleteMany({ where: { clinicId: { in: clinicIds } } });
  // Service assignments go with their membership or service (cascade).
  await db.clinicMembership.deleteMany({
    where: { clinicId: { in: clinicIds } },
  });
  await db.service.deleteMany({ where: { clinicId: { in: clinicIds } } });
  // Accounts and sessions cascade with the user.
  await db.user.deleteMany({
    where: { id: { in: memberships.map((row) => row.userId) } },
  });
  await db.clinic.deleteMany({ where: { id: { in: clinicIds } } });
}

export async function errorCodeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return (error as { code?: string }).code ?? "NO_CODE";
  }
  return "NO_ERROR";
}
