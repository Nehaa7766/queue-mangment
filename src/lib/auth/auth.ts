import { betterAuth, type BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import {
  queuePasswordResetEmail,
  RESET_TOKEN_SECONDS,
} from "@/features/notifications/password-reset";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";

type ResetPasswordRequest = {
  user: { id: string; email: string; name: string; status?: unknown };
  token: string;
};

type AuthConfig = {
  database: BetterAuthOptions["database"];
  secret: string;
  baseURL: string;
  // Secure (__Secure-) cookies need HTTPS; browsers drop them on plain http.
  secureCookies: boolean;
  // Off only in tests that sign in many times in a row.
  rateLimit?: boolean;
  // Header the reverse proxy sets with the client address. Without it
  // Better Auth can't tell clients apart and rate-limits everyone together.
  ipAddressHeader?: string;
  // Records the reset email; password reset is disabled without it.
  sendResetPassword?: (request: ResetPasswordRequest) => Promise<void>;
};

// Staff stay signed in for a working day; activity extends the session.
const SESSION_SECONDS = 60 * 60 * 12;

export function createAuth(config: AuthConfig) {
  return betterAuth({
    database: config.database,
    secret: config.secret,
    baseURL: config.baseURL,
    emailAndPassword: {
      enabled: true,
      // Staff accounts are created by clinic admins or the seed, never by
      // public sign-up (docs/PLAN.md §3).
      disableSignUp: true,
      resetPasswordTokenExpiresIn: RESET_TOKEN_SECONDS,
      // A new password signs the account out on every device.
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: config.sendResetPassword
        ? ({ user, token }) => config.sendResetPassword!({ user, token })
        : undefined,
    },
    user: {
      additionalFields: {
        platformRole: { type: ["SUPER_ADMIN"], required: false, input: false },
        status: { type: ["ACTIVE", "INACTIVE"], required: false, input: false },
      },
    },
    session: {
      expiresIn: SESSION_SECONDS,
      updateAge: 60 * 60,
    },
    databaseHooks: {
      session: {
        create: {
          // A deactivated user keeps their password but can't start a session.
          before: async (session, ctx) => {
            const user = await ctx?.context.internalAdapter.findUserById(
              session.userId,
            );
            if (!user || (user as { status?: string }).status === "INACTIVE") {
              return false;
            }
          },
        },
      },
    },
    rateLimit: {
      enabled: config.rateLimit ?? true,
      // Slow down password guessing (docs/PLAN.md §13).
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 60, max: 3 },
        "/reset-password": { window: 60, max: 5 },
      },
    },
    advanced: {
      // Ids are uuid columns in PostgreSQL.
      database: { generateId: "uuid" },
      useSecureCookies: config.secureCookies,
      ipAddress: config.ipAddressHeader
        ? { ipAddressHeaders: [config.ipAddressHeader] }
        : undefined,
    },
    // Lets server actions set the session cookie through next/headers.
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

let cachedAuth: Auth | undefined;

// Created on first use so `next build` works without secrets or a database.
export function getAuth(): Auth {
  if (!cachedAuth) {
    const env = getEnv();
    cachedAuth = createAuth({
      database: prismaAdapter(getDb(), { provider: "postgresql" }),
      secret: env.BETTER_AUTH_SECRET,
      baseURL: env.BETTER_AUTH_URL,
      secureCookies: env.BETTER_AUTH_URL.startsWith("https://"),
      ipAddressHeader: env.TRUSTED_IP_HEADER,
      sendResetPassword: queuePasswordResetEmail,
    });
  }
  return cachedAuth;
}
