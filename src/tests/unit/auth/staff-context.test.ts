import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSessionUser } from "@/lib/auth/session";
import { getStaffContext, loadStaffContext } from "@/lib/auth/staff-context";
import { getDb } from "@/lib/db";

vi.mock("@/lib/auth/session", () => ({ getSessionUser: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));

const findFirst = vi.fn();

beforeEach(() => {
  findFirst.mockReset();
  vi.mocked(getDb).mockReturnValue({
    clinicMembership: { findFirst },
  } as unknown as ReturnType<typeof getDb>);
});

describe("loadStaffContext", () => {
  it("returns the user's clinic and role", async () => {
    findFirst.mockResolvedValue({
      id: "membership-1",
      role: "RECEPTIONIST",
      user: { name: "Neha Reception", email: "reception@demo-clinic.test" },
      clinic: {
        id: "clinic-1",
        name: "Demo Clinic",
        slug: "demo-clinic",
        timezone: "Asia/Kolkata",
      },
    });

    await expect(loadStaffContext("user-1")).resolves.toEqual({
      user: {
        userId: "user-1",
        name: "Neha Reception",
        email: "reception@demo-clinic.test",
      },
      clinic: {
        id: "clinic-1",
        name: "Demo Clinic",
        slug: "demo-clinic",
        timezone: "Asia/Kolkata",
      },
      membershipId: "membership-1",
      role: "RECEPTIONIST",
    });
  });

  it("only looks at active memberships of active users and clinics", async () => {
    findFirst.mockResolvedValue(null);

    await expect(loadStaffContext("user-1")).resolves.toBeNull();
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          status: "ACTIVE",
          user: { status: "ACTIVE" },
          clinic: { status: "ACTIVE" },
        },
      }),
    );
  });
});

describe("getStaffContext", () => {
  it("returns null when nobody is signed in", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);

    await expect(getStaffContext()).resolves.toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });
});
