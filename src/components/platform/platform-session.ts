import { redirect } from "next/navigation";
import { cache } from "react";
import { UNAUTHORIZED_PATH } from "@/lib/auth/home";
import { getSessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";

export type PlatformUser = { userId: string; name: string; email: string };

// One session lookup per request, shared by the platform layout and pages.
// Null when signed out; "forbidden" for signed-in users who aren't super admins.
export const loadPlatformUser = cache(
  async (): Promise<PlatformUser | "forbidden" | null> => {
    const session = await getSessionUser();
    if (!session) return null;
    if (session.platformRole !== "SUPER_ADMIN") return "forbidden";
    const user = await getDb().user.findUnique({
      where: { id: session.userId },
      select: { name: true, email: true },
    });
    return user ? { userId: session.userId, ...user } : null;
  },
);

// For platform pages. Data functions still check the role themselves.
export async function requirePlatformPage(): Promise<PlatformUser> {
  const user = await loadPlatformUser();
  if (!user) redirect("/login");
  if (user === "forbidden") redirect(UNAUTHORIZED_PATH);
  return user;
}
