import { vi } from "vitest";
import type { MembershipRole } from "@/generated/prisma/enums";
import { getSessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { getOrCreateTodayQueue } from "@/features/queue/service";

// Test files must call vi.mock("@/lib/auth/session", ...) themselves (vi.mock
// is hoisted per file); actAs() then switches the signed-in user.

export function actAs(user: { id: string } | null): void {
  vi.mocked(getSessionUser).mockResolvedValue(
    user ? { userId: user.id, platformRole: null } : null,
  );
}

export type ClinicFixture = Awaited<ReturnType<typeof createClinicFixture>>;

// A clinic with its own staff and today's queue for one service. Everything
// gets a unique suffix because parallel test runs share the database.
export async function createClinicFixture(options?: {
  serviceMinutes?: number;
  maxQueueSize?: number | null;
}) {
  const db = getDb();
  const run = crypto.randomUUID().slice(0, 8);
  const clinic = await db.clinic.create({
    data: {
      name: `Test Clinic ${run}`,
      slug: `test-clinic-${run}`,
      maxQueueSize: options?.maxQueueSize ?? null,
    },
  });
  const service = await db.service.create({
    data: {
      clinicId: clinic.id,
      name: "General",
      tokenPrefix: "A",
      estimatedDurationMinutes: options?.serviceMinutes ?? 10,
    },
  });

  const addStaff = async (role: MembershipRole, label: string) => {
    const user = await db.user.create({
      data: { name: `${label} ${run}`, email: `${label}-${run}@example.test` },
    });
    const membership = await db.clinicMembership.create({
      data: { clinicId: clinic.id, userId: user.id, role },
    });
    return { id: user.id, membershipId: membership.id };
  };
  const receptionist = await addStaff("RECEPTIONIST", "reception");
  const doctor = await addStaff("DOCTOR", "doctor");
  const secondDoctor = await addStaff("DOCTOR", "doctor2");
  const admin = await addStaff("CLINIC_ADMIN", "admin");

  const queue = await getOrCreateTodayQueue(service.id);

  return {
    run,
    clinic,
    service,
    queue,
    receptionist,
    doctor,
    secondDoctor,
    admin,
  };
}

export async function deleteClinicFixtures(
  fixtures: readonly (ClinicFixture | undefined)[],
): Promise<void> {
  const db = getDb();
  const clinicIds = fixtures.flatMap((fixture) =>
    fixture ? [fixture.clinic.id] : [],
  );
  if (clinicIds.length === 0) {
    return;
  }
  const queues = await db.queue.findMany({
    where: { clinicId: { in: clinicIds } },
    select: { id: true },
  });
  const memberships = await db.clinicMembership.findMany({
    where: { clinicId: { in: clinicIds } },
    select: { userId: true },
  });

  await db.auditEvent.deleteMany({ where: { clinicId: { in: clinicIds } } });
  await db.idempotencyRecord.deleteMany({
    where: {
      OR: queues.map((queue) => ({
        scope: { startsWith: `queue:${queue.id}:` },
      })),
    },
  });
  await db.queueToken.deleteMany({ where: { clinicId: { in: clinicIds } } });
  await db.queue.deleteMany({ where: { clinicId: { in: clinicIds } } });
  await db.service.deleteMany({ where: { clinicId: { in: clinicIds } } });
  await db.clinicMembership.deleteMany({
    where: { clinicId: { in: clinicIds } },
  });
  await db.user.deleteMany({
    where: { id: { in: memberships.map((membership) => membership.userId) } },
  });
  await db.clinic.deleteMany({ where: { id: { in: clinicIds } } });
}
