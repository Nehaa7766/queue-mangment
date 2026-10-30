import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertSameClinic,
  requireClinicPermission,
  requireClinicRole,
  requirePlatformAdmin,
  requireSession,
} from "@/lib/auth/guards";
import { getSessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";

vi.mock("@/lib/auth/session", () => ({ getSessionUser: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));

const findUnique = vi.fn();
const sessionUser = { userId: "user-1", platformRole: null };

function activeMembership(role: string) {
  return {
    id: "membership-1",
    role,
    status: "ACTIVE",
    user: { status: "ACTIVE" },
    clinic: { status: "ACTIVE" },
  };
}

async function expectCode(promise: Promise<unknown>, code: string) {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe(code);
}

beforeEach(() => {
  vi.mocked(getSessionUser).mockResolvedValue(sessionUser);
  vi.mocked(getDb).mockReturnValue({
    clinicMembership: { findUnique },
  } as unknown as ReturnType<typeof getDb>);
  findUnique.mockReset();
});

describe("requireSession", () => {
  it("rejects anonymous requests", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);
    await expectCode(requireSession(), "UNAUTHENTICATED");
  });
});

describe("requirePlatformAdmin", () => {
  it("rejects clinic staff", async () => {
    await expectCode(requirePlatformAdmin(), "FORBIDDEN");
  });

  it("accepts a super admin", async () => {
    vi.mocked(getSessionUser).mockResolvedValue({
      userId: "admin-1",
      platformRole: "SUPER_ADMIN",
    });
    await expect(requirePlatformAdmin()).resolves.toMatchObject({
      userId: "admin-1",
    });
  });
});

describe("requireClinicRole", () => {
  it("looks up the membership for the given clinic and signed-in user", async () => {
    findUnique.mockResolvedValue(activeMembership("RECEPTIONIST"));
    const access = await requireClinicRole("clinic-a", ["RECEPTIONIST"]);

    expect(access).toEqual({
      user: sessionUser,
      clinicId: "clinic-a",
      membershipId: "membership-1",
      role: "RECEPTIONIST",
    });
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clinicId_userId: { clinicId: "clinic-a", userId: "user-1" } },
      }),
    );
  });

  it("rejects users with no membership in the clinic", async () => {
    findUnique.mockResolvedValue(null);
    await expectCode(
      requireClinicRole("clinic-b", ["RECEPTIONIST"]),
      "FORBIDDEN",
    );
  });

  it("rejects a role that is not allowed", async () => {
    findUnique.mockResolvedValue(activeMembership("DOCTOR"));
    await expectCode(
      requireClinicRole("clinic-a", ["CLINIC_ADMIN"]),
      "FORBIDDEN",
    );
  });

  it.each([
    ["membership", { ...activeMembership("RECEPTIONIST"), status: "INACTIVE" }],
    ["invitation", { ...activeMembership("RECEPTIONIST"), status: "INVITED" }],
    [
      "user",
      { ...activeMembership("RECEPTIONIST"), user: { status: "INACTIVE" } },
    ],
    [
      "clinic",
      { ...activeMembership("RECEPTIONIST"), clinic: { status: "INACTIVE" } },
    ],
  ])("rejects an inactive %s", async (_label, membership) => {
    findUnique.mockResolvedValue(membership);
    await expectCode(
      requireClinicRole("clinic-a", ["RECEPTIONIST"]),
      "FORBIDDEN",
    );
  });
});

describe("requireClinicPermission", () => {
  it("uses the permission matrix", async () => {
    findUnique.mockResolvedValue(activeMembership("DOCTOR"));
    await expect(
      requireClinicPermission("clinic-a", "consultation.start"),
    ).resolves.toMatchObject({ role: "DOCTOR" });

    findUnique.mockResolvedValue(activeMembership("DOCTOR"));
    await expectCode(
      requireClinicPermission("clinic-a", "staff.manage"),
      "FORBIDDEN",
    );
  });
});

describe("assertSameClinic", () => {
  it("rejects a resource from another clinic", () => {
    expect(() =>
      assertSameClinic("clinic-b", { clinicId: "clinic-a" }),
    ).toThrow(AppError);
    expect(() =>
      assertSameClinic("clinic-a", { clinicId: "clinic-a" }),
    ).not.toThrow();
  });
});
