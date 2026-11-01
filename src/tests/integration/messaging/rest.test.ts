import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  GET as getConversationMessages,
  POST as sendStaffMessage,
} from "@/app/api/messages/conversations/[conversationId]/messages/route";
import { POST as readStaff } from "@/app/api/messages/conversations/[conversationId]/read/route";
import { GET as getInbox } from "@/app/api/messages/conversations/route";
import { POST as startConversation } from "@/app/api/messages/tokens/[tokenId]/[channel]/route";
import { GET as getUnread } from "@/app/api/messages/unread/route";
import {
  GET as getPatientMessages,
  POST as sendPatientMessage,
} from "@/app/api/public/tokens/[publicTokenId]/messages/[channel]/route";
import { POST as readPatient } from "@/app/api/public/tokens/[publicTokenId]/messages/[channel]/read/route";
import { GET as getPatientSummary } from "@/app/api/public/tokens/[publicTokenId]/messages/route";
import {
  INBOX_PAGE_SIZE,
  type InboxPage,
  type MessagePage,
  type MessageView,
  type PatientMessagingSummary,
} from "@/features/messaging/contracts";
import { getDb } from "@/lib/db";
import {
  actAs,
  createClinicFixture,
  deleteMessagingFixtures,
  expectError,
  get,
  joinAs,
  params,
  post,
  type ClinicFixture,
} from "./fixtures";

// Needs the test database with migrations applied (npm run db:deploy).
vi.mock("@/lib/auth/session", () => ({ getSessionUser: vi.fn() }));
// connection() only works inside a real Next.js request.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));

let clinic: ClinicFixture;
let other: ClinicFixture;
// Its own clinic, so the paging test sees only its own chats.
let paging: ClinicFixture;

beforeAll(async () => {
  [clinic, other, paging] = await Promise.all([
    createClinicFixture(),
    createClinicFixture(),
    createClinicFixture(),
  ]);
});

afterAll(async () => {
  await deleteMessagingFixtures([clinic, other, paging]);
});

const HOUR = 60 * 60_000;

function patientSend(
  publicTokenId: string,
  body: string,
  id = crypto.randomUUID(),
) {
  return sendPatientMessage(
    post({ clientMessageId: id, body }),
    params({ publicTokenId, channel: "reception" }),
  );
}

async function patientPage(publicTokenId: string, channel = "reception") {
  const response = await getPatientMessages(
    get(),
    params({ publicTokenId, channel }),
  );
  expect(response.status).toBe(200);
  return (await response.json()) as MessagePage;
}

async function summary(publicTokenId: string) {
  const response = await getPatientSummary(get(), params({ publicTokenId }));
  expect(response.status).toBe(200);
  return (await response.json()) as PatientMessagingSummary;
}

async function inbox(query = "") {
  const response = await getInbox(
    get(`http://test/api/messages/conversations${query}`),
    {},
  );
  expect(response.status).toBe(200);
  return (await response.json()) as InboxPage;
}

function staffSend(
  conversationId: string,
  body: string,
  id = crypto.randomUUID(),
) {
  return sendStaffMessage(
    post({ clientMessageId: id, body }),
    params({ conversationId }),
  );
}

async function staffPage(conversationId: string) {
  const response = await getConversationMessages(
    get(),
    params({ conversationId }),
  );
  expect(response.status).toBe(200);
  return (await response.json()) as MessagePage;
}

async function conversationOf(tokenId: string) {
  return getDb().conversation.findUniqueOrThrow({
    where: { tokenId_channel: { tokenId, channel: "RECEPTION" } },
  });
}

describe("patient chat", () => {
  it("starts with two empty chats and the service doctors answering", async () => {
    const token = await joinAs(clinic, "Asha");

    const result = await summary(token.publicTokenId);

    expect(result.reception).toEqual({
      conversationId: null,
      channel: "RECEPTION",
      closed: false,
      unread: 0,
      routing: null,
    });
    expect(result.doctor).toMatchObject({
      conversationId: null,
      channel: "DOCTOR",
      routing: { kind: "SERVICE_DOCTORS", serviceName: "General" },
    });
  });

  it("stores a message once and replays it for a retry", async () => {
    const token = await joinAs(clinic, "Ravi");
    const id = crypto.randomUUID();

    const first = await patientSend(
      token.publicTokenId,
      "  Is the doctor in?\r\n\n\n\nThanks ",
      id,
    );
    const retry = await patientSend(
      token.publicTokenId,
      "Is the doctor in?\n\nThanks",
      id,
    );

    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    const stored = (await first.json()) as MessageView;
    expect(stored).toMatchObject({
      clientMessageId: id,
      sender: "PATIENT",
      senderName: null,
      body: "Is the doctor in?\n\nThanks",
      seen: false,
      isAnnouncement: false,
    });
    expect(((await retry.json()) as MessageView).id).toBe(stored.id);
    expect((await patientPage(token.publicTokenId)).messages).toHaveLength(1);
  });

  it("refuses the same clientMessageId with different text", async () => {
    const token = await joinAs(clinic);
    const id = crypto.randomUUID();
    await patientSend(token.publicTokenId, "First", id);

    const response = await patientSend(token.publicTokenId, "Second", id);

    await expectError(response, 409, "IDEMPOTENCY_CONFLICT");
  });

  it("explains empty, long and malformed messages", async () => {
    const token = await joinAs(clinic);

    const empty = await expectError(
      await patientSend(token.publicTokenId, " \n\t "),
      400,
      "VALIDATION_ERROR",
    );
    const long = await expectError(
      await patientSend(token.publicTokenId, "x".repeat(1001)),
      400,
      "VALIDATION_ERROR",
    );
    await expectError(
      await sendPatientMessage(
        post({ clientMessageId: "not-a-uuid", body: "Hi" }),
        params({ publicTokenId: token.publicTokenId, channel: "reception" }),
      ),
      400,
      "VALIDATION_ERROR",
    );

    expect(empty.message).toBe("Write a message first.");
    expect(long.message).toBe("Keep it under 1,000 characters.");
    expect(
      await getDb().conversation.count({ where: { tokenId: token.tokenId } }),
    ).toBe(0);
  });

  it("returns 404 for an unknown token or channel", async () => {
    const token = await joinAs(clinic);

    await expectError(
      await patientSend(crypto.randomUUID(), "Hello"),
      404,
      "TOKEN_NOT_FOUND",
    );
    await expectError(
      await getPatientMessages(
        get(),
        params({ publicTokenId: token.publicTokenId, channel: "billing" }),
      ),
      404,
      "CONVERSATION_NOT_FOUND",
    );
  });

  it("limits a token link to 10 messages a minute, but not retries", async () => {
    const token = await joinAs(clinic);
    const firstId = crypto.randomUUID();
    for (let i = 0; i < 10; i += 1) {
      const id = i === 0 ? firstId : crypto.randomUUID();
      expect(
        (await patientSend(token.publicTokenId, `Message ${i}`, id)).status,
      ).toBe(201);
    }

    await expectError(
      await patientSend(token.publicTokenId, "One too many"),
      429,
      "RATE_LIMITED",
    );
    // A retry after a lost response still gets its stored message.
    expect(
      (await patientSend(token.publicTokenId, "Message 0", firstId)).status,
    ).toBe(200);
  });
});

describe("staff replies, reads and Seen", () => {
  it("shows the patient's message to reception and the reply to the patient", async () => {
    const token = await joinAs(clinic, "Meera");
    await patientSend(token.publicTokenId, "Can I get water?");
    const conversation = await conversationOf(token.tokenId);

    actAs(clinic.receptionist);
    const listed = (await inbox()).items.find(
      (item) => item.conversationId === conversation.id,
    );
    expect(listed).toMatchObject({
      channel: "RECEPTION",
      unread: 1,
      closed: false,
      routing: null,
      token: {
        id: token.tokenId,
        patientName: "Meera",
        serviceName: "General",
      },
      lastMessage: { body: "Can I get water?", sender: "PATIENT" },
    });

    const reply = await staffSend(conversation.id, "Yes, at the desk.");
    expect(reply.status).toBe(201);
    expect(await reply.json()).toMatchObject({
      sender: "STAFF",
      senderName: `reception ${clinic.run}`,
    });

    // Replying counts as reading: the patient's message shows Seen.
    const patientView = await patientPage(token.publicTokenId);
    expect(
      patientView.messages.map((m) => [m.sender, m.senderName, m.seen]),
    ).toEqual([
      ["PATIENT", null, true],
      ["STAFF", "Reception", false],
    ]);
    expect(patientView.conversation.unread).toBe(1);

    const read = await readPatient(
      post(),
      params({ publicTokenId: token.publicTokenId, channel: "reception" }),
    );
    expect(await read.json()).toEqual({ ok: true });
    expect((await summary(token.publicTokenId)).reception.unread).toBe(0);
    const staffView = await staffPage(conversation.id);
    expect(staffView.messages.at(-1)).toMatchObject({
      sender: "STAFF",
      seen: true,
    });
    // Staff pages carry the token for the chat header; patient pages don't.
    expect(staffView.token).toMatchObject({
      id: token.tokenId,
      patientName: "Meera",
      serviceName: "General",
    });
    expect(patientView.token).toBeUndefined();
  });

  it("clears the staff unread count and badge when staff read", async () => {
    const token = await joinAs(clinic, "Kiran");
    await patientSend(token.publicTokenId, "One");
    await patientSend(token.publicTokenId, "Two");
    const conversation = await conversationOf(token.tokenId);
    actAs(clinic.receptionist);
    const before = (await (await getUnread(get(), {})).json()).conversations;
    expect(conversation.unreadByStaff).toBe(2);

    const response = await readStaff(
      post(),
      params({ conversationId: conversation.id }),
    );

    expect(response.status).toBe(200);
    const after = await conversationOf(token.tokenId);
    expect(after.unreadByStaff).toBe(0);
    expect(after.staffReadAt).not.toBeNull();
    expect((await (await getUnread(get(), {})).json()).conversations).toBe(
      before - 1,
    );
    const page = await patientPage(token.publicTokenId);
    expect(page.messages.every((m) => m.seen)).toBe(true);
  });

  it("starts a reception chat from a queue row, once", async () => {
    const token = await joinAs(clinic, "Walk-in");
    actAs(clinic.receptionist);

    const first = await startConversation(
      post(),
      params({ tokenId: token.tokenId, channel: "reception" }),
    );
    const again = await startConversation(
      post(),
      params({ tokenId: token.tokenId, channel: "reception" }),
    );

    expect(first.status).toBe(201);
    expect(again.status).toBe(200);
    const { conversationId } = await first.json();
    expect((await again.json()).conversationId).toBe(conversationId);
    expect(
      (await inbox()).items.find((i) => i.conversationId === conversationId),
    ).toMatchObject({ lastMessage: null, unread: 0 });
    expect((await summary(token.publicTokenId)).reception.conversationId).toBe(
      conversationId,
    );
  });

  it("pages older messages with ?before=", async () => {
    const token = await joinAs(clinic);
    actAs(clinic.receptionist);
    const started = await startConversation(
      post(),
      params({ tokenId: token.tokenId, channel: "reception" }),
    );
    const { conversationId } = await started.json();
    const db = getDb();
    const base = Date.now() - 60_000;
    await db.message.createMany({
      data: Array.from({ length: 55 }, (_, i) => ({
        conversationId,
        clinicId: clinic.clinic.id,
        sender: "PATIENT" as const,
        body: `Old ${i}`,
        clientMessageId: crypto.randomUUID(),
        createdAt: new Date(base + i * 100),
      })),
    });

    const newest = await staffPage(conversationId);
    const response = await getConversationMessages(
      get(`http://test/api?before=${newest.messages[0].id}`),
      params({ conversationId }),
    );
    const older = (await response.json()) as MessagePage;

    expect(newest.messages).toHaveLength(50);
    expect(newest.hasOlder).toBe(true);
    expect(newest.messages[0].body).toBe("Old 5");
    expect(newest.messages.at(-1)!.body).toBe("Old 54");
    expect(older.messages.map((m) => m.body)).toEqual([
      "Old 0",
      "Old 1",
      "Old 2",
      "Old 3",
      "Old 4",
    ]);
    expect(older.hasOlder).toBe(false);
    await expectError(
      await getConversationMessages(
        get(`http://test/api?before=${crypto.randomUUID()}`),
        params({ conversationId }),
      ),
      400,
      "VALIDATION_ERROR",
    );
  });
});

describe("isolation", () => {
  it("keeps one patient's chat out of another patient's link", async () => {
    const a = await joinAs(clinic, "Patient A");
    const b = await joinAs(clinic, "Patient B");
    await patientSend(a.publicTokenId, "Private to A");

    const seenByB = await patientPage(b.publicTokenId);

    expect(seenByB.messages).toEqual([]);
    expect(seenByB.conversation.conversationId).toBeNull();
    expect(
      (await summary(b.publicTokenId)).reception.conversationId,
    ).toBeNull();
  });

  it("needs a staff session for chat ids", async () => {
    const a = await joinAs(clinic);
    await patientSend(a.publicTokenId, "Hello");
    const conversation = await conversationOf(a.tokenId);
    actAs(null);

    await expectError(
      await staffPage401(conversation.id),
      401,
      "UNAUTHENTICATED",
    );
    await expectError(
      await staffSend(conversation.id, "Hi"),
      401,
      "UNAUTHENTICATED",
    );
    await expectError(await getInbox(get(), {}), 401, "UNAUTHENTICATED");
  });

  it("answers 404 to staff of another clinic", async () => {
    const a = await joinAs(clinic, "Cross");
    await patientSend(a.publicTokenId, "Hello");
    const conversation = await conversationOf(a.tokenId);
    actAs(other.admin);

    await expectError(
      await staffPage401(conversation.id),
      404,
      "CONVERSATION_NOT_FOUND",
    );
    await expectError(
      await staffSend(conversation.id, "Hi"),
      404,
      "CONVERSATION_NOT_FOUND",
    );
    await expectError(
      await readStaff(post(), params({ conversationId: conversation.id })),
      404,
      "CONVERSATION_NOT_FOUND",
    );
    await expectError(
      await startConversation(
        post(),
        params({ tokenId: a.tokenId, channel: "reception" }),
      ),
      404,
      "TOKEN_NOT_FOUND",
    );
    expect(
      (await inbox()).items.some((i) => i.conversationId === conversation.id),
    ).toBe(false);
    expect(
      await getDb().message.count({
        where: { conversationId: conversation.id },
      }),
    ).toBe(1);
  });
});

function staffPage401(conversationId: string) {
  return getConversationMessages(get(), params({ conversationId }));
}

describe("closed chats", () => {
  it("turns read-only 2 hours after the visit ends, but still answers retries", async () => {
    const token = await joinAs(clinic);
    const id = crypto.randomUUID();
    await patientSend(token.publicTokenId, "Before the end", id);
    await getDb().queueToken.update({
      where: { id: token.tokenId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(Date.now() - 3 * HOUR),
      },
    });
    const conversation = await conversationOf(token.tokenId);

    await expectError(
      await patientSend(token.publicTokenId, "After"),
      409,
      "CONVERSATION_CLOSED",
    );
    expect(
      (await patientSend(token.publicTokenId, "Before the end", id)).status,
    ).toBe(200);
    actAs(clinic.receptionist);
    await expectError(
      await staffSend(conversation.id, "Reply"),
      409,
      "CONVERSATION_CLOSED",
    );
    expect((await patientPage(token.publicTokenId)).conversation.closed).toBe(
      true,
    );
    expect((await staffPage(conversation.id)).conversation.closed).toBe(true);
  });

  it("stays open within 2 hours of the visit ending", async () => {
    const token = await joinAs(clinic);
    await getDb().queueToken.update({
      where: { id: token.tokenId },
      data: { status: "CANCELLED", cancelledAt: new Date(Date.now() - HOUR) },
    });

    expect((await patientSend(token.publicTokenId, "Still open")).status).toBe(
      201,
    );
  });

  it("closes a day after joining, and reopens on requeue", async () => {
    const old = await joinAs(clinic);
    await getDb().queueToken.update({
      where: { id: old.tokenId },
      data: { joinedAt: new Date(Date.now() - 25 * HOUR) },
    });
    const skipped = await joinAs(clinic);
    await getDb().queueToken.update({
      where: { id: skipped.tokenId },
      data: { status: "SKIPPED", skippedAt: new Date(Date.now() - 3 * HOUR) },
    });

    await expectError(
      await patientSend(old.publicTokenId, "Late"),
      409,
      "CONVERSATION_CLOSED",
    );
    await expectError(
      await patientSend(skipped.publicTokenId, "Hi"),
      409,
      "CONVERSATION_CLOSED",
    );

    await getDb().queueToken.update({
      where: { id: skipped.tokenId },
      data: { status: "WAITING", skippedAt: null },
    });
    expect(
      (await patientSend(skipped.publicTokenId, "Back in line")).status,
    ).toBe(201);
  });

  it("does not create a chat for a closed visit", async () => {
    const token = await joinAs(clinic);
    await getDb().queueToken.update({
      where: { id: token.tokenId },
      data: { joinedAt: new Date(Date.now() - 25 * HOUR) },
    });
    actAs(clinic.receptionist);

    await expectError(
      await startConversation(
        post(),
        params({ tokenId: token.tokenId, channel: "reception" }),
      ),
      409,
      "CONVERSATION_CLOSED",
    );
  });
});

describe("inbox", () => {
  it("filters by unread, open, closed, channel and search", async () => {
    const open = await joinAs(clinic, "Filterable Unread");
    await patientSend(open.publicTokenId, "Unread one");
    const closed = await joinAs(clinic, "Filterable Closed");
    await patientSend(closed.publicTokenId, "Old one");
    await getDb().queueToken.update({
      where: { id: closed.tokenId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(Date.now() - 3 * HOUR),
      },
    });
    const openId = (await conversationOf(open.tokenId)).id;
    const closedId = (await conversationOf(closed.tokenId)).id;
    actAs(clinic.receptionist);
    await readStaff(post(), params({ conversationId: closedId }));

    const ids = async (query: string) =>
      (await inbox(query)).items.map((item) => item.conversationId);

    expect(await ids("?filter=unread&q=filterable")).toEqual([openId]);
    expect(await ids("?filter=open&q=filterable")).toEqual([openId]);
    expect(await ids("?filter=closed&q=filterable")).toEqual([closedId]);
    expect(await ids("?q=FILTERABLE")).toEqual([closedId, openId]);
    expect(await ids("?channel=doctor&q=filterable")).toEqual([]);
    const label = (
      await getDb().queueToken.findUniqueOrThrow({
        where: { id: open.tokenId },
      })
    ).tokenLabel;
    expect(await ids(`?q=${label}&channel=reception`)).toContain(openId);
    await expectError(
      await getInbox(get("http://test/api?filter=starred"), {}),
      400,
      "VALIDATION_ERROR",
    );
    await expectError(
      await getInbox(get("http://test/api?cursor=nonsense"), {}),
      400,
      "VALIDATION_ERROR",
    );
  });

  it("pages newest first with a cursor, chats without messages last", async () => {
    const db = getDb();
    const tokens = [];
    for (let i = 0; i < INBOX_PAGE_SIZE + 3; i += 1) {
      tokens.push(await joinAs(paging, `Paged ${i}`));
    }
    const base = Date.now() - HOUR;
    await db.conversation.createMany({
      data: tokens.map((token, i) => ({
        clinicId: paging.clinic.id,
        tokenId: token.tokenId,
        channel: "RECEPTION" as const,
        // The last two have no messages yet.
        lastMessageAt: i < tokens.length - 2 ? new Date(base + i * 1000) : null,
      })),
    });
    actAs(paging.receptionist);

    const first = await inbox();
    const second = await inbox(`?cursor=${first.nextCursor}`);

    expect(first.items).toHaveLength(INBOX_PAGE_SIZE);
    expect(first.nextCursor).not.toBeNull();
    expect(second.items).toHaveLength(3);
    expect(second.nextCursor).toBeNull();
    const names = [...first.items, ...second.items].map(
      (i) => i.token.patientName,
    );
    expect(names.slice(0, 3)).toEqual(["Paged 30", "Paged 29", "Paged 28"]);
    expect(new Set(names).size).toBe(tokens.length);
    expect(second.items.slice(-2).every((i) => i.lastMessage === null)).toBe(
      true,
    );
  });
});
