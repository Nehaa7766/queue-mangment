import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import type { MembershipRole } from "@/generated/prisma/enums";
import { UNAUTHORIZED_PATH } from "@/lib/auth/home";
import { getStaffContext, type StaffContext } from "@/lib/auth/staff-context";

// One session lookup per request, shared by the staff layout and its pages.
export const loadStaffContext = cache(getStaffContext);

// For staff pages: the signed-in member, or a redirect to log in or to the
// "no access" page. Data functions still check permissions themselves.
export async function requireStaffPage(
  roles: readonly MembershipRole[],
): Promise<StaffContext> {
  const context = await loadStaffContext();
  if (!context) redirect("/login");
  if (!roles.includes(context.role)) redirect(UNAUTHORIZED_PATH);
  return context;
}

// Request time for client clocks to start from, so the server render and
// hydration agree. Never prerendered.
export async function requestNow(): Promise<number> {
  await connection();
  return Date.now();
}

export const RECEPTION_ROLES = [
  "RECEPTIONIST",
  "CLINIC_ADMIN",
] as const satisfies readonly MembershipRole[];
