import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { requireClinicRole } from "@/lib/auth/guards";
import { getSessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";

// Needs the test database with migrations applied (npm run db:deploy).
vi.mock("@/lib/auth/session", () => ({ getSessionUser: vi.fn() }));

const run = crypto.randomUUID().slice(0, 8);
const ids: { clinicA?: string; clinicB?: string; user?: string } = {};

beforeAll(async () => {
  const db = getDb();
  const [clinicA, clinicB] = await Promise.all([
    db.clinic.create({ data: { name: "Clinic A", slug: `clinic-a-${run}` } }),
    db.clinic.create({ data: { name: "Clinic B", slug: `clinic-b-${run}` } }),
  ]);
  const user = await db.user.create({
    data: { name: "Reception A", email: `reception-${run}@example.test` },
  });
  await db.clinicMembership.create({
    data: { clinicId: clinicA.id, userId: user.id, role: "RECEPTIONIST" },
  });
  Object.assign(ids, {
    clinicA: clinicA.id,
    clinicB: clinicB.id,
    user: user.id,
  });
  vi.mocked(getSessionUser).mockResolvedValue({
    userId: user.id,
    platformRole: null,
  });
});

afterAll(async () => {
  const db = getDb();
  await db.clinicMembership.deleteMany({ where: { userId: ids.user } });
  await db.user.deleteMany({ where: { id: ids.user } });
  await db.clinic.deleteMany({
    where: { id: { in: [ids.clinicA!, ids.clinicB!] } },
  });
});

describe("tenant isolation", () => {
  it("allows staff into their own clinic", async () => {
    await expect(
      requireClinicRole(ids.clinicA!, ["RECEPTIONIST"]),
    ).resolves.toMatchObject({
      clinicId: ids.clinicA,
      role: "RECEPTIONIST",
    });
  });

  it("rejects staff from another clinic", async () => {
    const error = await requireClinicRole(ids.clinicB!, ["RECEPTIONIST"]).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("FORBIDDEN");
  });
});
