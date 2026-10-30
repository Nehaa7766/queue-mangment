import { prismaAdapter } from "better-auth/adapters/prisma";
import { hashPassword } from "better-auth/crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAuth } from "@/lib/auth/auth";
import { loadStaffContext } from "@/lib/auth/staff-context";
import { getDb } from "@/lib/db";

// Needs the test database with migrations applied (npm run db:deploy).
// Uses the real Prisma adapter, so it proves the auth tables match Better Auth.
const run = crypto.randomUUID().slice(0, 8);
const PASSWORD = "integration-pass-123";
const ids: { clinic?: string; active?: string; invited?: string } = {};

const auth = createAuth({
  database: prismaAdapter(getDb(), { provider: "postgresql" }),
  secret: "test-secret-0123456789abcdef0123456789",
  baseURL: "http://localhost:3000",
  secureCookies: false,
  rateLimit: false,
});

async function createStaff(
  email: string,
  clinicId: string,
  membershipStatus: "ACTIVE" | "INVITED",
) {
  const db = getDb();
  const user = await db.user.create({ data: { name: email, email } });
  await db.account.create({
    data: {
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: await hashPassword(PASSWORD),
    },
  });
  await db.clinicMembership.create({
    data: {
      clinicId,
      userId: user.id,
      role: "RECEPTIONIST",
      status: membershipStatus,
    },
  });
  return user.id;
}

beforeAll(async () => {
  const clinic = await getDb().clinic.create({
    data: { name: "Auth Clinic", slug: `auth-clinic-${run}` },
  });
  ids.clinic = clinic.id;
  ids.active = await createStaff(
    `active-${run}@example.test`,
    clinic.id,
    "ACTIVE",
  );
  ids.invited = await createStaff(
    `invited-${run}@example.test`,
    clinic.id,
    "INVITED",
  );
});

afterAll(async () => {
  const db = getDb();
  const userIds = [ids.active!, ids.invited!];
  // Sessions and accounts cascade with the user.
  await db.clinicMembership.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.clinic.deleteMany({ where: { id: ids.clinic } });
});

describe("sign-in against PostgreSQL", () => {
  it("signs in with the right password and stores a session", async () => {
    const result = await auth.api.signInEmail({
      body: { email: `active-${run}@example.test`, password: PASSWORD },
    });

    expect(result.user.id).toBe(ids.active);
    const sessions = await getDb().session.count({
      where: { userId: ids.active },
    });
    expect(sessions).toBeGreaterThan(0);
  });

  it("rejects a wrong password", async () => {
    const response = await auth.api.signInEmail({
      body: { email: `active-${run}@example.test`, password: "wrong-pass-1" },
      asResponse: true,
    });

    expect(response.status).toBe(401);
  });
});

describe("loadStaffContext", () => {
  it("returns the active membership with its clinic", async () => {
    const context = await loadStaffContext(ids.active!);

    expect(context).toMatchObject({
      role: "RECEPTIONIST",
      clinic: { id: ids.clinic, slug: `auth-clinic-${run}` },
    });
  });

  it("ignores an unaccepted invitation", async () => {
    await expect(loadStaffContext(ids.invited!)).resolves.toBeNull();
  });

  it("returns null once the membership is deactivated", async () => {
    await getDb().clinicMembership.updateMany({
      where: { userId: ids.active },
      data: { status: "INACTIVE" },
    });

    await expect(loadStaffContext(ids.active!)).resolves.toBeNull();
  });
});
