import { describe, expect, it } from "vitest";
import { homePathFor } from "@/lib/auth/home";

describe("homePathFor", () => {
  it.each([
    ["RECEPTIONIST", "/receptionist"],
    ["DOCTOR", "/doctor"],
    ["CLINIC_ADMIN", "/admin/dashboard"],
  ] as const)("sends a %s to %s", (role, path) => {
    expect(homePathFor({ platformRole: null, role })).toBe(path);
  });

  it("sends a platform admin to the platform panel, even with a clinic role", () => {
    expect(
      homePathFor({ platformRole: "SUPER_ADMIN", role: "RECEPTIONIST" }),
    ).toBe("/super-admin/dashboard");
  });

  it("sends a user with no role to the no-access page", () => {
    expect(homePathFor({ platformRole: null, role: null })).toBe(
      "/unauthorized",
    );
  });
});
