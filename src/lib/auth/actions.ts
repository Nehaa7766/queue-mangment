"use server";

import { homePathFor, UNAUTHORIZED_PATH } from "./home";
import { getSessionUser } from "./session";
import { loadStaffContext } from "./staff-context";

// Called by the login form right after a successful sign-in, so the browser
// can go straight to the user's panel.
export async function getHomePath(): Promise<string> {
  const user = await getSessionUser();
  if (!user) {
    return UNAUTHORIZED_PATH;
  }
  const staff = await loadStaffContext(user.userId);
  return homePathFor({
    platformRole: user.platformRole,
    role: staff?.role ?? null,
  });
}
