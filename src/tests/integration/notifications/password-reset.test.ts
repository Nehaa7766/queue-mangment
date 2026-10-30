import { hashPassword } from "better-auth/crypto";
import { afterAll, describe, expect, it } from "vitest";
import { getAuth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db";

const userIds: string[] = [];

async function createStaffUser(status: "ACTIVE" | "INACTIVE" = "ACTIVE") {
  const user = await getDb().user.create({
    data: {
      name: "Reset Tester",
      email: `reset-${crypto.randomUUID()}@notifications.test`,
      status,
    },
  });
  userIds.push(user.id);
  return user;
}

async function requestReset(email: string) {
  return getAuth().api.requestPasswordReset({ body: { email } });
}

function resetEvents(userId: string) {
  return getDb().outboxEvent.findMany({
    where: { aggregateId: userId, eventType: "auth.password-reset-requested" },
  });
}

afterAll(async () => {
  const db = getDb();
  await db.outboxEvent.deleteMany({ where: { aggregateId: { in: userIds } } });
  await db.verification.deleteMany({ where: { value: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});

describe("password reset requests", () => {
  it("record one email in the outbox with a link to our reset page", async () => {
    const user = await createStaffUser();

    const response = await requestReset(user.email);

    expect(response.status).toBe(true);
    const events = await resetEvents(user.id);
    expect(events).toHaveLength(1);
    const payload = events[0].payload as Record<string, string>;
    expect(payload).toMatchObject({
      userId: user.id,
      email: user.email,
      name: "Reset Tester",
    });

    const url = new URL(payload.resetUrl);
    expect(`${url.origin}${url.pathname}`).toBe(
      `${process.env.BETTER_AUTH_URL}/reset-password`,
    );
    const token = url.searchParams.get("token");
    expect(token).toBeTruthy();
    const verification = await getDb().verification.findFirst({
      where: { identifier: `reset-password:${token}` },
    });
    expect(verification?.value).toBe(user.id);

    const minutesLeft =
      (new Date(payload.expiresAt).getTime() - Date.now()) / 60_000;
    expect(minutesLeft).toBeGreaterThan(55);
    expect(minutesLeft).toBeLessThanOrEqual(60);
  });

  it("answer the same for an unknown email and record nothing", async () => {
    const email = `nobody-${crypto.randomUUID()}@notifications.test`;

    const response = await requestReset(email);

    expect(response.status).toBe(true);
    const events = await getDb().outboxEvent.findMany({
      where: {
        eventType: "auth.password-reset-requested",
        payload: { path: ["email"], equals: email },
      },
    });
    expect(events).toHaveLength(0);
  });

  it("skip deactivated accounts", async () => {
    const user = await createStaffUser("INACTIVE");

    await requestReset(user.email);

    expect(await resetEvents(user.id)).toHaveLength(0);
  });

  it("send at most three emails an hour to one address", async () => {
    const user = await createStaffUser();

    for (let request = 0; request < 5; request++) {
      expect((await requestReset(user.email)).status).toBe(true);
    }

    expect(await resetEvents(user.id)).toHaveLength(3);
  });
});

describe("resetting with the emailed token", () => {
  it("changes the password, signs out other sessions and works once", async () => {
    const user = await createStaffUser();
    await getDb().account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: await hashPassword("old-password-123"),
      },
    });
    const auth = getAuth();
    const signIn = (password: string) =>
      auth.api.signInEmail({
        body: { email: user.email, password },
        asResponse: true,
      });

    const oldSession = await signIn("old-password-123");
    expect(oldSession.status).toBe(200);
    const cookie = oldSession.headers.get("set-cookie")!.split(";")[0];

    await requestReset(user.email);
    const [event] = await resetEvents(user.id);
    const token = new URL(
      (event.payload as Record<string, string>).resetUrl,
    ).searchParams.get("token")!;

    await expect(
      auth.api.resetPassword({
        body: { newPassword: "new-password-456", token },
      }),
    ).resolves.toEqual({ status: true });

    expect(
      await auth.api.getSession({ headers: new Headers({ cookie }) }),
    ).toBeNull();
    expect((await signIn("old-password-123")).status).toBe(401);
    expect((await signIn("new-password-456")).status).toBe(200);
    await expect(
      auth.api.resetPassword({
        body: { newPassword: "third-password-789", token },
      }),
    ).rejects.toThrow();
  });
});
