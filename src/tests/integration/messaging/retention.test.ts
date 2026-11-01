import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  deleteClinicMessaging,
  MESSAGES_DELETED,
  runRetention,
} from "@/features/retention/retention";
import { getDb } from "@/lib/db";
import {
  createClinicFixture,
  deleteMessagingFixtures,
  joinAs,
  type ClinicFixture,
} from "./fixtures";

// Needs the test database with migrations applied. Only rows this file
// back-dates are old enough to expire, so the full job run below leaves
// other test files' data alone.

const DAY_MS = 24 * 60 * 60_000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

let clinic: ClinicFixture;
let longer: ClinicFixture;

beforeAll(async () => {
  [clinic, longer] = await Promise.all([
    createClinicFixture(),
    createClinicFixture(),
  ]);
  const db = getDb();
  await db.clinic.update({
    where: { id: clinic.clinic.id },
    data: { patientDataRetentionDays: 30 },
  });
  await db.clinic.update({
    where: { id: longer.clinic.id },
    data: { patientDataRetentionDays: 90 },
  });
});

afterAll(async () => {
  await deleteMessagingFixtures([clinic, longer]);
});

// A chat created `createdDays` ago with one message per entry in `messageDays`.
async function chat(
  fixture: ClinicFixture,
  createdDays: number,
  messageDays: number[],
) {
  const db = getDb();
  const token = await joinAs(fixture);
  const conversation = await db.conversation.create({
    data: {
      clinicId: fixture.clinic.id,
      tokenId: token.tokenId,
      channel: "RECEPTION",
      createdAt: daysAgo(createdDays),
    },
  });
  for (const days of messageDays) {
    await db.message.create({
      data: {
        conversationId: conversation.id,
        clinicId: fixture.clinic.id,
        sender: "PATIENT",
        body: "Patient text",
        clientMessageId: crypto.randomUUID(),
        createdAt: daysAgo(days),
      },
    });
  }
  return { token, conversation };
}

async function broadcast(fixture: ClinicFixture, createdDays: number) {
  const db = getDb();
  const token = await joinAs(fixture);
  return db.broadcast.create({
    data: {
      clinicId: fixture.clinic.id,
      body: "Announcement text",
      serviceIds: [],
      totalRecipients: 1,
      idempotencyKey: crypto.randomUUID(),
      createdAt: daysAgo(createdDays),
      recipients: { create: [{ tokenId: token.tokenId, status: "SENT" }] },
    },
  });
}

const exists = {
  conversation: (id: string) => getDb().conversation.count({ where: { id } }),
  messages: (conversationId: string) =>
    getDb().message.count({ where: { conversationId } }),
  broadcast: (id: string) => getDb().broadcast.count({ where: { id } }),
};

describe("deleting old messages", () => {
  it("deletes messages, emptied chats and announcements past the retention period", async () => {
    const old = await chat(clinic, 40, [40, 39]);
    const recent = await chat(clinic, 2, [2, 1]);
    // Old chat with one old and one recent message: only the old one goes.
    const mixed = await chat(clinic, 40, [40, 1]);
    const empty = await chat(clinic, 40, []);
    const oldBroadcast = await broadcast(clinic, 40);
    const newBroadcast = await broadcast(clinic, 1);

    const deleted = await deleteClinicMessaging({
      id: clinic.clinic.id,
      patientDataRetentionDays: 30,
    });

    expect(deleted).toEqual({ messages: 3, conversations: 2, broadcasts: 1 });
    expect(await exists.conversation(old.conversation.id)).toBe(0);
    expect(await exists.conversation(empty.conversation.id)).toBe(0);
    expect(await exists.messages(recent.conversation.id)).toBe(2);
    expect(await exists.conversation(mixed.conversation.id)).toBe(1);
    expect(await exists.messages(mixed.conversation.id)).toBe(1);
    expect(await exists.broadcast(oldBroadcast.id)).toBe(0);
    expect(
      await getDb().broadcastRecipient.count({
        where: { broadcastId: oldBroadcast.id },
      }),
    ).toBe(0);
    expect(await exists.broadcast(newBroadcast.id)).toBe(1);

    const events = await getDb().auditEvent.findMany({
      where: { clinicId: clinic.clinic.id, action: MESSAGES_DELETED },
    });
    expect(events).toHaveLength(1);
    expect(events[0].metadata).toMatchObject({
      messages: 3,
      conversations: 2,
      broadcasts: 1,
      retentionDays: 30,
    });
    expect(JSON.stringify(events[0].metadata)).not.toContain("text");
  });

  it("finds nothing on a rerun and records nothing", async () => {
    const deleted = await deleteClinicMessaging({
      id: clinic.clinic.id,
      patientDataRetentionDays: 30,
    });

    expect(deleted).toEqual({ messages: 0, conversations: 0, broadcasts: 0 });
    expect(
      await getDb().auditEvent.count({
        where: { clinicId: clinic.clinic.id, action: MESSAGES_DELETED },
      }),
    ).toBe(1);
  });

  it("follows each clinic's own period in the daily job", async () => {
    const kept = await chat(longer, 40, [40]);
    const expired = await chat(clinic, 40, [40]);

    const result = await runRetention();

    expect(result.messagesDeleted).toBeGreaterThanOrEqual(1);
    expect(result.conversationsDeleted).toBeGreaterThanOrEqual(1);
    expect(await exists.conversation(expired.conversation.id)).toBe(0);
    expect(await exists.messages(kept.conversation.id)).toBe(1);
  });
});
