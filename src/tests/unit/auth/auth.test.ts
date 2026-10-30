// @vitest-environment node
import { readFileSync } from "node:fs";
import { memoryAdapter } from "better-auth/adapters/memory";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "@/lib/auth/auth";

// Runs the real Better Auth flows against an in-memory store, so it needs no
// database. The password hash comes from prisma/seed.sql, which proves the
// seeded logins work with the password "queuecare-dev".
const SEED_HASH = /'([0-9a-f]{32}:[0-9a-f]{128})'/.exec(
  readFileSync("prisma/seed.sql", "utf8"),
)![1];

type Store = Record<string, Record<string, unknown>[]>;

function userRow(
  id: string,
  email: string,
  extra: Record<string, unknown> = {},
) {
  const now = new Date();
  return {
    id,
    name: email,
    email,
    emailVerified: false,
    image: null,
    platformRole: null,
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
    ...extra,
  };
}

function credentialRow(userId: string) {
  const now = new Date();
  return {
    id: `account-${userId}`,
    userId,
    accountId: userId,
    providerId: "credential",
    password: SEED_HASH,
    createdAt: now,
    updatedAt: now,
  };
}

let store: Store;
let auth: ReturnType<typeof createAuth>;

beforeEach(() => {
  store = {
    user: [
      userRow("u-reception", "reception@demo-clinic.test"),
      userRow("u-super", "superadmin@queuecare.test", {
        platformRole: "SUPER_ADMIN",
      }),
      userRow("u-inactive", "gone@demo-clinic.test", { status: "INACTIVE" }),
    ],
    account: [
      credentialRow("u-reception"),
      credentialRow("u-super"),
      credentialRow("u-inactive"),
    ],
    session: [],
    verification: [],
  };
  auth = createAuth({
    database: memoryAdapter(store),
    secret: "test-secret-0123456789abcdef0123456789",
    baseURL: "http://localhost:3000",
    secureCookies: false,
    rateLimit: false,
  });
});

async function signIn(email: string, password: string) {
  return auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
  });
}

describe("email and password sign-in", () => {
  it("signs in a seeded user and returns their session", async () => {
    const response = await signIn(
      "reception@demo-clinic.test",
      "queuecare-dev",
    );
    expect(response.status).toBe(200);

    const cookie = response.headers.get("set-cookie")!;
    const session = await auth.api.getSession({
      headers: new Headers({ cookie: cookie.split(";")[0] }),
    });
    expect(session?.user.email).toBe("reception@demo-clinic.test");
    expect(session?.user.status).toBe("ACTIVE");
  });

  it("exposes the platform role on the session", async () => {
    const response = await signIn("superadmin@queuecare.test", "queuecare-dev");
    const session = await auth.api.getSession({
      headers: new Headers({
        cookie: response.headers.get("set-cookie")!.split(";")[0],
      }),
    });

    expect(session?.user.platformRole).toBe("SUPER_ADMIN");
  });

  it("rejects a wrong password", async () => {
    const response = await signIn("reception@demo-clinic.test", "wrong-pass");

    expect(response.status).toBe(401);
    expect(store.session).toHaveLength(0);
  });

  it("refuses to start a session for a deactivated user", async () => {
    const response = await signIn("gone@demo-clinic.test", "queuecare-dev");

    expect(response.ok).toBe(false);
    expect(store.session).toHaveLength(0);
  });

  it("has public sign-up turned off", async () => {
    const response = await auth.api.signUpEmail({
      body: {
        name: "Stranger",
        email: "stranger@example.test",
        password: "long-enough-password",
      },
      asResponse: true,
    });

    expect(response.ok).toBe(false);
    expect(store.user).toHaveLength(3);
  });
});
