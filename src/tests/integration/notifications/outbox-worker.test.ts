import { afterAll, afterEach, describe, expect, it } from "vitest";
import {
  MAX_ATTEMPTS,
  processOutboxBatch,
} from "@/features/notifications/outbox-worker";
import { getDb } from "@/lib/db";
import type { EmailMessage, EmailSender } from "@/lib/email";

// Other test files share this database and may write outbox events at the
// real current time. These tests run the worker at a time in the year 2000,
// so only their own events (due in 2000) are ever claimed.
const T0 = new Date("2000-01-01T00:00:00.000Z");
const minutesAfter = (minutes: number) =>
  new Date(T0.getTime() + minutes * 60_000);

const created: string[] = [];

function resetPayload(suffix: string, overrides: object = {}) {
  return {
    userId: `user-${suffix}`,
    email: `staff-${suffix}@outbox.test`,
    name: "Asha",
    resetUrl: `https://app.test/reset-password?token=tok-${suffix}`,
    expiresAt: minutesAfter(60 * 24 * 7).toISOString(),
    ...overrides,
  };
}

async function createEvent(
  eventType: string,
  payload: object,
): Promise<string> {
  const event = await getDb().outboxEvent.create({
    data: {
      eventType,
      aggregateId: `outbox-test-${crypto.randomUUID()}`,
      payload,
      nextAttemptAt: T0,
    },
  });
  created.push(event.id);
  return event.id;
}

function capturingSender(): EmailSender & { messages: EmailMessage[] } {
  const messages: EmailMessage[] = [];
  return {
    messages,
    async send(message) {
      messages.push(message);
      // Give a concurrent worker time to try to claim the same rows.
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { id: null };
    },
  };
}

const failingSender: EmailSender = {
  async send() {
    throw new Error(
      "Provider said no for staff-x@outbox.test about https://app.test/reset-password?token=tok-x",
    );
  },
};

afterEach(async () => {
  await getDb().outboxEvent.deleteMany({ where: { id: { in: created } } });
  created.length = 0;
});

afterAll(async () => {
  await getDb().$disconnect();
});

describe("processOutboxBatch", () => {
  it("sends each event exactly once when two workers run at the same time", async () => {
    const ids = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        createEvent("auth.password-reset-requested", resetPayload(`c${index}`)),
      ),
    );
    const sender = capturingSender();
    const now = minutesAfter(1);

    const [first, second] = await Promise.all([
      processOutboxBatch({ sender, now }),
      processOutboxBatch({ sender, now }),
    ]);

    expect(first.sent + second.sent).toBe(10);
    expect(sender.messages).toHaveLength(10);
    expect(new Set(sender.messages.map((m) => m.idempotencyKey))).toEqual(
      new Set(ids.map((id) => `outbox-${id}`)),
    );

    const rows = await getDb().outboxEvent.findMany({
      where: { id: { in: ids } },
    });
    expect(rows.every((row) => row.processedAt && row.attemptCount === 1)).toBe(
      true,
    );

    // A later run finds nothing left to send.
    const again = await processOutboxBatch({ sender, now: minutesAfter(30) });
    expect(again.claimed).toBe(0);
    expect(sender.messages).toHaveLength(10);
  });

  it("removes the one-time link once the email is sent", async () => {
    const id = await createEvent(
      "auth.password-reset-requested",
      resetPayload("strip"),
    );
    const sender = capturingSender();

    await processOutboxBatch({ sender, now: minutesAfter(1) });

    expect(sender.messages[0].to).toBe("staff-strip@outbox.test");
    expect(sender.messages[0].text).toContain("token=tok-strip");
    const row = await getDb().outboxEvent.findUniqueOrThrow({ where: { id } });
    expect(row.payload).not.toHaveProperty("resetUrl");
    expect(row.payload).toMatchObject({ email: "staff-strip@outbox.test" });
    expect(JSON.stringify(row.payload)).not.toContain("tok-strip");
  });

  it("backs off after failures and gives up after the last attempt", async () => {
    const id = await createEvent(
      "auth.password-reset-requested",
      resetPayload("x"),
    );
    let now = minutesAfter(1);

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const result = await processOutboxBatch({ sender: failingSender, now });
      expect(result.claimed).toBe(1);

      const row = await getDb().outboxEvent.findUniqueOrThrow({
        where: { id },
      });
      expect(row.attemptCount).toBe(attempt);
      expect(row.processedAt).toBeNull();
      expect(row.lastError).toBe("Provider said no for [email] about [link]");

      if (attempt < MAX_ATTEMPTS) {
        expect(row.failedAt).toBeNull();
        const waitMs = row.nextAttemptAt.getTime() - now.getTime();
        expect(waitMs).toBe(Math.min(2 ** (attempt - 1), 60) * 60_000);
        // Not due again before the backoff ends.
        const early = await processOutboxBatch({
          sender: failingSender,
          now: new Date(row.nextAttemptAt.getTime() - 1000),
        });
        expect(early.claimed).toBe(0);
        now = row.nextAttemptAt;
      } else {
        expect(row.failedAt).toEqual(now);
      }
    }

    // A flagged event is never picked up again.
    const later = await processOutboxBatch({
      sender: failingSender,
      now: minutesAfter(60 * 24 * 6),
    });
    expect(later.claimed).toBe(0);
  });

  it("does not send links that expired while retrying", async () => {
    const id = await createEvent(
      "auth.password-reset-requested",
      resetPayload("late", { expiresAt: minutesAfter(30).toISOString() }),
    );
    const sender = capturingSender();

    const result = await processOutboxBatch({ sender, now: minutesAfter(31) });

    expect(result.failed).toBe(1);
    expect(sender.messages).toHaveLength(0);
    const row = await getDb().outboxEvent.findUniqueOrThrow({ where: { id } });
    expect(row.failedAt).not.toBeNull();
    expect(row.lastError).toBe(
      "The link expired before the email could be sent.",
    );
  });

  it("flags unknown event types and invalid payloads without retrying", async () => {
    const unknown = await createEvent("patient.sms", { phone: "1" });
    const invalid = await createEvent("staff.invited", { email: "x" });
    const sender = capturingSender();

    const result = await processOutboxBatch({ sender, now: minutesAfter(1) });

    expect(result).toMatchObject({ claimed: 2, failed: 2, sent: 0 });
    const rows = await getDb().outboxEvent.findMany({
      where: { id: { in: [unknown, invalid] } },
      orderBy: { createdAt: "asc" },
    });
    expect(rows.map((row) => row.lastError)).toEqual([
      'Unknown event type "patient.sms".',
      "The event payload is invalid.",
    ]);
    expect(rows.every((row) => row.failedAt)).toBe(true);
  });

  it("renders staff invitations", async () => {
    await createEvent("staff.invited", {
      invitationId: "inv-1",
      email: "new-doctor@outbox.test",
      name: "Dr. Mehta",
      clinicName: "Demo Clinic",
      role: "DOCTOR",
      acceptUrl: "https://app.test/accept-invite?token=inv-secret",
      expiresAt: minutesAfter(60 * 24 * 7).toISOString(),
    });
    const sender = capturingSender();

    await processOutboxBatch({ sender, now: minutesAfter(1) });

    expect(sender.messages).toHaveLength(1);
    expect(sender.messages[0].subject).toBe(
      "You're invited to Demo Clinic on QueueCare",
    );
    expect(sender.messages[0].text).toContain("as a doctor");
  });
});
