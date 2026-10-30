import type { MembershipRole, PlatformRole } from "@/generated/prisma/enums";

const ROLE_HOME: Record<MembershipRole, string> = {
  RECEPTIONIST: "/receptionist",
  DOCTOR: "/doctor",
  CLINIC_ADMIN: "/admin/dashboard",
};

export const PLATFORM_ADMIN_HOME = "/super-admin/dashboard";
export const UNAUTHORIZED_PATH = "/unauthorized";

// Where a user lands after signing in. Platform admins go to the platform
// panel; staff go to their clinic role's home; anyone else has no panel.
export function homePathFor(input: {
  platformRole: PlatformRole | null;
  role: MembershipRole | null;
}): string {
  if (input.platformRole === "SUPER_ADMIN") {
    return PLATFORM_ADMIN_HOME;
  }
  return input.role ? ROLE_HOME[input.role] : UNAUTHORIZED_PATH;
}
