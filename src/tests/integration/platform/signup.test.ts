import { verifyPassword } from "better-auth/crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { POST as signupRoute } from "@/app/api/onboarding/signup/route";
import { GET as slugRoute } from "@/app/api/onboarding/slug-availability/route";
import {
  assertSignupsOpen,
  checkSlugAvailability,
  signUpClinic,
} from "@/features/onboarding/signup";
import type { SignupInput } from "@/features/onboarding/signup-schema";
import { setClinicStatus } from "@/features/platform/clinics";
import { DEFAULT_PLATFORM_SETTINGS } from "@/features/platform/settings";
import { loadStaffContext } from "@/lib/auth/staff-context";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { actAs, cleanUp, createUser, createdTracker } from "./fixtures";

// Needs the test database migrated.
vi.mock("@/lib/auth/session", () => ({ getSessionUser: vi.fn() }));

const created = createdTracker();
const PASSWORD = "signup-pass-123";

afterAll(async () => {
  await cleanUp(created);
});

function input(overrides: Partial<SignupInput> = {}): SignupInput {
  const run = crypto.randomUUID().slice(0, 8);
  return {
    clinicName: `Signup Clinic ${run}`,
    clinicSlug: `signup-${run}`,
    timezone: "Asia/Kolkata",
    serviceName: "General",
    tokenPrefix: "A",
    serviceMinutes: 12,
    adminName: `Owner ${run}`,
    adminEmail: `owner-${run}@example.test`,
    password: PASSWORD,
    ...overrides,
  };
}

async function signUp(data: SignupInput) {
  const result = await signUpClinic(data);
  created.clinicIds.push(result.clinicId);
  created.userIds.push(result.userId);
  return result;
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(AppError);
  return (error as AppError).code;
}

describe("signUpClinic", () => {
  it("creates the clinic, service, admin and login together", async () => {
    const data = input();

    const result = await signUp(data);

    const db = getDb();
    const clinic = await db.clinic.findUniqueOrThrow({
      where: { id: result.clinicId },
      include: {
        services: true,
        memberships: true,
      },
    });
    expect(clinic).toMatchObject({
      name: data.clinicName,
      slug: data.clinicSlug,
      status: "INACTIVE",
    });
    expect(clinic.services).toMatchObject([
      { name: "General", tokenPrefix: "A", estimatedDurationMinutes: 12 },
    ]);
    expect(clinic.memberships).toMatchObject([
      { userId: result.userId, role: "CLINIC_ADMIN", status: "ACTIVE" },
    ]);
    // Billing was removed: no subscription or trial is started.
    expect(
      await db.subscription.count({ where: { clinicId: result.clinicId } }),
    ).toBe(0);

    const account = await db.account.findFirstOrThrow({
      where: { userId: result.userId, providerId: "credential" },
    });
    expect(account.accountId).toBe(result.userId);
    expect(
      await verifyPassword({ hash: account.password!, password: PASSWORD }),
    ).toBe(true);

    const audit = await db.platformAuditEvent.findMany({
      where: { targetId: result.clinicId },
    });
    expect(audit).toMatchObject([
      { action: "clinic.signed_up", actorUserId: result.userId },
    ]);
  });

  it("rejects a slug that is already taken and creates nothing", async () => {
    const first = await signUp(input());
    const second = input({ clinicSlug: first.clinicSlug });

    expect(await codeOf(signUpClinic(second))).toBe("VALIDATION_ERROR");
    expect(
      await getDb().user.count({ where: { email: second.adminEmail } }),
    ).toBe(0);
  });

  it("rejects an email that already has an account", async () => {
    const existing = await createUser(created, "existing");
    const data = input({ adminEmail: existing.email });

    expect(await codeOf(signUpClinic(data))).toBe("VALIDATION_ERROR");
    expect(
      await getDb().clinic.count({ where: { slug: data.clinicSlug } }),
    ).toBe(0);
  });

  it("rolls everything back when a late step fails", async () => {
    const data = input();

    await expect(
      signUpClinic(data, {
        beforeCommit: async () => {
          throw new Error("Simulated failure");
        },
      }),
    ).rejects.toThrow("Simulated failure");

    const db = getDb();
    expect(await db.clinic.count({ where: { slug: data.clinicSlug } })).toBe(0);
    expect(await db.user.count({ where: { email: data.adminEmail } })).toBe(0);
  });

  it("refuses sign-ups when they are switched off", () => {
    expect(() =>
      assertSignupsOpen({
        ...DEFAULT_PLATFORM_SETTINGS,
        signupsEnabled: false,
      }),
    ).toThrow(AppError);
    expect(() => assertSignupsOpen(DEFAULT_PLATFORM_SETTINGS)).not.toThrow();
  });

  it("keeps a new clinic's staff out until a super admin approves it", async () => {
    const result = await signUp(input());
    expect(await loadStaffContext(result.userId)).toBeNull();

    const admin = await createUser(created, "approver", "SUPER_ADMIN");
    actAs(admin, "SUPER_ADMIN");
    await setClinicStatus(result.clinicId, "ACTIVE");

    expect((await loadStaffContext(result.userId))?.role).toBe("CLINIC_ADMIN");
  });
});

describe("checkSlugAvailability", () => {
  it("reports taken, reserved and free addresses", async () => {
    const taken = await signUp(input());

    expect(await checkSlugAvailability(taken.clinicSlug)).toEqual({
      available: false,
      reason: "That address is taken. Try another.",
    });
    expect(await checkSlugAvailability("admin")).toEqual({
      available: false,
      reason: "This address is reserved.",
    });
    expect(
      await checkSlugAvailability(`free-${crypto.randomUUID().slice(0, 8)}`),
    ).toEqual({ available: true });
  });
});

describe("onboarding routes", () => {
  it("signs up through the API and returns 201 pending approval", async () => {
    const data = input();
    const response = await signupRoute(
      new Request("http://test/api/onboarding/signup", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          // Its own rate-limit bucket, separate from other test runs.
          "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}`,
        },
        body: JSON.stringify(data),
      }),
      {},
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      clinicSlug: data.clinicSlug,
      status: "PENDING_APPROVAL",
    });
    const clinic = await getDb().clinic.findUniqueOrThrow({
      where: { slug: data.clinicSlug },
      select: { id: true, memberships: { select: { userId: true } } },
    });
    created.clinicIds.push(clinic.id);
    created.userIds.push(...clinic.memberships.map((m) => m.userId));
  });

  it("rejects an invalid body with 400", async () => {
    const response = await signupRoute(
      new Request("http://test/api/onboarding/signup", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "10.0.1.1",
        },
        body: JSON.stringify({ clinicName: "x" }),
      }),
      {},
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("answers slug availability checks", async () => {
    const response = await slugRoute(
      new Request("http://test/api/onboarding/slug-availability?slug=Admin"),
      {},
    );

    expect(await response.json()).toEqual({
      slug: "Admin",
      available: false,
      reason: "This address is reserved.",
    });
  });
});
