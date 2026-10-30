import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { createRateLimiter } from "@/lib/rate-limit";
import { enqueueOutboxEvent } from "./events";

// How long a reset link works. Better Auth enforces it on the token.
export const RESET_TOKEN_SECONDS = 60 * 60;

// Better Auth already limits requests per IP; this stops anyone filling one
// person's inbox from many IPs. Over the limit we skip the email silently, so
// the response never reveals whether the account exists.
const perEmailLimiter = createRateLimiter({ limit: 3, windowMs: 60 * 60_000 });

type ResetUser = {
  id: string;
  email: string;
  name: string;
  status?: unknown;
};

// The link opens our own page with the token, which then calls Better Auth's
// reset endpoint (src/app/(auth)/reset-password).
export function resetPasswordUrl(baseUrl: string, token: string): string {
  const url = new URL("/reset-password", baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

// Better Auth's sendResetPassword hook. Records the email in the outbox; the
// worker sends it (docs/PLAN.md §10).
export async function queuePasswordResetEmail(data: {
  user: ResetUser;
  token: string;
}): Promise<void> {
  const { user, token } = data;
  // A deactivated account can't sign in, so a reset would only mislead.
  if (user.status === "INACTIVE") {
    return;
  }
  if (!perEmailLimiter.check(user.email.toLowerCase()).allowed) {
    return;
  }

  const expiresAt = new Date(Date.now() + RESET_TOKEN_SECONDS * 1000);
  await getDb().$transaction(async (tx) => {
    await enqueueOutboxEvent(tx, "auth.password-reset-requested", user.id, {
      userId: user.id,
      email: user.email,
      name: user.name,
      resetUrl: resetPasswordUrl(getEnv().BETTER_AUTH_URL, token),
      expiresAt: expiresAt.toISOString(),
    });
  });
}
