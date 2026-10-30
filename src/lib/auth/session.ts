import { headers } from "next/headers";
import type { PlatformRole } from "@/generated/prisma/enums";
import { getAuth } from "./auth";

export type SessionUser = {
  userId: string;
  platformRole: PlatformRole | null;
};

// The signed-in user from the Better Auth session cookie, or null when
// nobody is signed in. Everything in src/lib/auth builds on this function.
// Reads request headers, so pages must call it inside a <Suspense> boundary.
export async function getSessionUser(): Promise<SessionUser | null> {
  // Read the request first: during prerendering this is where Next stops,
  // before the auth instance (and its secrets) is ever needed.
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session || session.user.status === "INACTIVE") {
    return null;
  }
  return {
    userId: session.user.id,
    platformRole: session.user.platformRole ?? null,
  };
}
