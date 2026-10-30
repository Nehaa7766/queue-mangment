import type { MembershipRole } from "@/generated/prisma/enums";
import { getDb } from "@/lib/db";
import { getSessionUser } from "./session";

export type StaffContext = {
  user: { userId: string; name: string; email: string };
  clinic: { id: string; name: string; slug: string; timezone: string };
  membershipId: string;
  role: MembershipRole;
};

// The signed-in staff member and their clinic, for staff layouts and pages.
// Null when signed out or without an active membership.
// Assumption: staff screens use the user's first active membership; a clinic
// switcher can come later.
export async function getStaffContext(): Promise<StaffContext | null> {
  const user = await getSessionUser();
  return user ? loadStaffContext(user.userId) : null;
}

// Same active checks as the guards: user, membership and clinic must all be
// active, and an unaccepted invitation doesn't count.
export async function loadStaffContext(
  userId: string,
): Promise<StaffContext | null> {
  const membership = await getDb().clinicMembership.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      user: { status: "ACTIVE" },
      clinic: { status: "ACTIVE" },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      user: { select: { name: true, email: true } },
      clinic: {
        select: { id: true, name: true, slug: true, timezone: true },
      },
    },
  });
  if (!membership) {
    return null;
  }
  return {
    user: { userId, name: membership.user.name, email: membership.user.email },
    clinic: membership.clinic,
    membershipId: membership.id,
    role: membership.role,
  };
}
