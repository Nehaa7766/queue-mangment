import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as getBroadcast } from "@/app/api/messages/announcements/[broadcastId]/route";
import { GET as getAudience } from "@/app/api/messages/announcements/audience/route";
import {
  GET as listAnnouncements,
  POST as createAnnouncement,
} from "@/app/api/messages/announcements/route";
import { GET as getPatientMessages } from "@/app/api/public/tokens/[publicTokenId]/messages/[channel]/route";
import { POST as readPatient } from "@/app/api/public/tokens/[publicTokenId]/messages/[channel]/read/route";
import { loadStaffMember, type StaffMember } from "@/features/messaging/access";
import {
  BROADCAST_SENT,
  createBroadcast,
  MAX_RECIPIENT_ATTEMPTS,
  processPendingBroadcasts,
} from "@/features/messaging/broadcasts";
import type {
  BroadcastAudience,
  BroadcastDetail,
  BroadcastSummary,
  MessagePage,
} from "@/features/messaging/contracts";
import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import {
  actAs,
  addService,
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
// after() only runs inside a real request: keep the task so a test can run it.
const { afterTasks, failingTokens } = vi.hoisted(() => ({
  afterTasks: [] as (() => Promise<unknown>)[],
  // Hints for these tokens throw, so their delivery transaction fails.
  failingTokens: new Set<string>(),
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
  after: (task: () => Promise<unknown>) => afterTasks.push(task),
}));
vi.mock("@/features/messaging/notify", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/messaging/notify")>();
  return {
    notifyMessaging: async (
      ...args: Parameters<typeof actual.notifyMessaging>
    ) => {
      const notification = args[1];
      if (
        "tokenId" in notification &&
        failingTokens.has(notification.tokenId)
      ) {
        throw new Error("Simulated failure");
      }
      return actual.notifyMessaging(...args);
    },
  };
});

// `routes` sends through the HTTP routes (they share one rate limit per
// clinic); `work` is for processing tests that call the service directly.
let routes: ClinicFixture;
let work: ClinicFixture;
let other: ClinicFixture;
let second: { id: string; queueId: string };
let empty: { id: string; queueId: string };

beforeAll(async () => {
  [routes, work, other] = await Promise.all([
    createClinicFixture(),
    createClinicFixture(),
    createClinicFixture(),
  ]);
  second = await addService(routes, "Second", "S");
  empty = await addService(routes, "Empty", "E");
});

afterAll(async () => {
  await deleteMessagingFixtures([routes, work, other]);
});

const HOUR = 60 * 60_000;

async function setStatus(tokenId: string, data: Prisma.QueueTokenUpdateInput) {
  await getDb().queueToken.update({ where: { id: tokenId }, data });
}

async function member(fixture: ClinicFixture): Promise<StaffMember> {
  return (await loadStaffMember(fixture.receptionist.id, fixture.clinic.id))!;
}

async function audience(query = "") {
  const response = await getAudience(get(`http://test/api${query}`), {});
  expect(response.status).toBe(200);
  return (await response.json()) as BroadcastAudience;
}

function create(body: unknown) {
  return createAnnouncement(post(body), {});
}

async function detail(broadcastId: string) {
  const response = await getBroadcast(get(), params({ broadcastId }));
  expect(response.status).toBe(200);
  return (await response.json()) as BroadcastDetail;
}

async function receptionPage(publicTokenId: string) {
  const response = await getPatientMessages(
    get(),
    params({ publicTokenId, channel: "reception" }),
  );
  return (await response.json()) as MessagePage;
}

async function announcementCount(broadcastId: string) {
  return getDb().message.count({ where: { broadcastId } });
}

describe("audience and creation (routes)", () => {
  let tokens: Record<string, { tokenId: string; publicTokenId: string }>;

  beforeAll(async () => {
    tokens = {
      waiting1: await joinAs(routes, "Waiting one"),
      waiting2: await joinAs(routes, "Waiting two"),
      called: await joinAs(routes, "Called"),
      inService: await joinAs(routes, "In service"),
      done: await joinAs(routes, "Done"),
      secondService: await joinAs(routes, "Second service", second.queueId),
    };
    await setStatus(tokens.called.tokenId, {
      status: "CALLED",
      calledAt: new Date(),
    });
    await setStatus(tokens.inService.tokenId, { status: "IN_SERVICE" });
    await setStatus(tokens.done.tokenId, {
      status: "COMPLETED",
      completedAt: new Date(),
    });
    // Yesterday's queue: still WAITING, but not today.
    const db = getDb();
    const today = await db.queue.findUniqueOrThrow({
      where: { id: routes.queue.id },
    });
    const yesterday = await db.queue.create({
      data: {
        clinicId: routes.clinic.id,
        serviceId: routes.service.id,
        queueDate: new Date(today.queueDate.getTime() - 24 * HOUR),
      },
    });
    await db.queueToken.create({
      data: {
        queueId: yesterday.id,
        clinicId: routes.clinic.id,
        serviceId: routes.service.id,
        sequenceNumber: 1,
        sortKey: 1,
        tokenLabel: "A-1",
        status: "WAITING",
      },
    });
  });

  it("counts patients waiting or called today, per service", async () => {
    actAs(routes.receptionist);

    const all = await audience();
    const chosen = await audience(`?serviceIds=${second.id}`);

    expect(all.eligible).toBe(4);
    expect(all.services).toEqual([
      {
        serviceId: routes.service.id,
        name: "General",
        tokenPrefix: "A",
        eligible: 3,
      },
      { serviceId: empty.id, name: "Empty", tokenPrefix: "E", eligible: 0 },
      { serviceId: second.id, name: "Second", tokenPrefix: "S", eligible: 1 },
    ]);
    expect(chosen.eligible).toBe(1);
    await expectError(
      await getAudience(
        get(`http://test/api?serviceIds=${other.service.id}`),
        {},
      ),
      400,
      "VALIDATION_ERROR",
    );
  });

  it("is for reception and clinic admins only", async () => {
    actAs(routes.doctor);

    await expectError(await getAudience(get(), {}), 403, "FORBIDDEN");
    await expectError(await listAnnouncements(get(), {}), 403, "FORBIDDEN");
    await expectError(
      await create({
        idempotencyKey: crypto.randomUUID(),
        body: "Hi",
        serviceIds: [],
      }),
      403,
      "FORBIDDEN",
    );
  });

  it("creates one announcement per key with a fixed recipient list", async () => {
    actAs(routes.admin);
    const key = crypto.randomUUID();
    const text = "The doctor is running 20 minutes late.";

    const first = await create({
      idempotencyKey: key,
      body: text,
      serviceIds: [],
    });
    const retry = await create({
      idempotencyKey: key,
      body: text,
      serviceIds: [],
    });
    const conflict = await create({
      idempotencyKey: key,
      body: "Other text",
      serviceIds: [],
    });

    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    await expectError(conflict, 409, "IDEMPOTENCY_CONFLICT");
    const summary = (await first.json()) as BroadcastSummary;
    expect((await retry.json()).id).toBe(summary.id);
    expect(summary).toMatchObject({
      body: text,
      createdByName: `admin ${routes.run}`,
      serviceNames: [],
      status: "SENDING",
      counts: { total: 4, pending: 4, sent: 0, skipped: 0, failed: 0, seen: 0 },
    });
    const recipients = await getDb().broadcastRecipient.findMany({
      where: { broadcastId: summary.id },
      select: { tokenId: true, status: true },
    });
    expect(recipients.map((r) => r.tokenId).sort()).toEqual(
      [tokens.waiting1, tokens.waiting2, tokens.called, tokens.secondService]
        .map((t) => t.tokenId)
        .sort(),
    );
    const audits = await getDb().auditEvent.findMany({
      where: { clinicId: routes.clinic.id, action: BROADCAST_SENT },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0].actorUserId).toBe(routes.admin.id);
    expect(audits[0].metadata).toMatchObject({
      broadcastId: summary.id,
      recipients: 4,
    });
    expect(JSON.stringify(audits[0])).not.toContain("running 20 minutes");

    // Delivery was handed to after(); run it as Next.js would.
    expect(afterTasks.length).toBeGreaterThanOrEqual(1);
    await Promise.all(afterTasks.splice(0).map((task) => task()));
    const sent = await detail(summary.id);
    expect(sent).toMatchObject({
      status: "DONE",
      counts: { sent: 4, pending: 0 },
    });
    const page = await receptionPage(tokens.waiting1.publicTokenId);
    expect(page.messages).toHaveLength(1);
    expect(page.messages[0]).toMatchObject({
      body: text,
      sender: "STAFF",
      senderName: "Reception",
      isAnnouncement: true,
    });
    expect(page.conversation.unread).toBe(1);
  });

  it("refuses an announcement nobody would get", async () => {
    actAs(routes.receptionist);

    const error = await expectError(
      await create({
        idempotencyKey: crypto.randomUUID(),
        body: "Hello",
        serviceIds: [empty.id],
      }),
      400,
      "VALIDATION_ERROR",
    );

    expect(error.message).toMatch(/Nobody is waiting/);
    await expectError(
      await create({
        idempotencyKey: crypto.randomUUID(),
        body: "Hi",
        serviceIds: [other.service.id],
      }),
      400,
      "VALIDATION_ERROR",
    );
  });

  it("lists announcements newest first and hides other clinics' ones", async () => {
    actAs(routes.receptionist);
    const listed = (await (
      await listAnnouncements(get(), {})
    ).json()) as BroadcastSummary[];
    expect(listed.length).toBeGreaterThanOrEqual(1);

    actAs(other.receptionist);
    expect(await (await listAnnouncements(get(), {})).json()).toEqual([]);
    await expectError(
      await getBroadcast(get(), params({ broadcastId: listed[0].id })),
      404,
      "ANNOUNCEMENT_NOT_FOUND",
    );
  });

  it("limits a clinic to 5 announcements in 10 minutes, but not retries", async () => {
    actAs(routes.receptionist);
    // Earlier tests in this file used 3 of them (one create and two
    // refusals); their retry and conflict were answered before counting.
    const fourth = crypto.randomUUID();
    for (const key of [fourth, crypto.randomUUID()]) {
      const response = await create({
        idempotencyKey: key,
        body: "Again",
        serviceIds: [],
      });
      expect(response.status).toBe(201);
    }

    await expectError(
      await create({
        idempotencyKey: crypto.randomUUID(),
        body: "Sixth",
        serviceIds: [],
      }),
      429,
      "RATE_LIMITED",
    );
    // A retry after a lost response still gets its announcement back.
    expect(
      (await create({ idempotencyKey: fourth, body: "Again", serviceIds: [] }))
        .status,
    ).toBe(200);
    afterTasks.length = 0;
  });
});

describe("processing", () => {
  it("skips patients whose visit moved on, and never sends twice", async () => {
    const staff = await member(work);
    const t = {
      ok: await joinAs(work, "Gets it"),
      started: await joinAs(work, "Started"),
      cancelled: await joinAs(work, "Cancelled"),
      stale: await joinAs(work, "Stale"),
    };
    const { summary } = await createBroadcast(staff, {
      idempotencyKey: crypto.randomUUID(),
      body: "Pharmacy closes at 6.",
      serviceIds: [],
    });
    await setStatus(t.started.tokenId, { status: "IN_SERVICE" });
    await setStatus(t.cancelled.tokenId, {
      status: "CANCELLED",
      cancelledAt: new Date(),
    });
    await setStatus(t.stale.tokenId, {
      joinedAt: new Date(Date.now() - 25 * HOUR),
    });

    const run = await processPendingBroadcasts({ broadcastId: summary.id });
    const rerun = await processPendingBroadcasts({ broadcastId: summary.id });

    expect(run).toMatchObject({ sent: 1, skipped: 3, failed: 0, completed: 1 });
    expect(rerun).toMatchObject({ sent: 0, skipped: 0, completed: 0 });
    expect(await announcementCount(summary.id)).toBe(1);
    actAs(work.receptionist);
    const result = await detail(summary.id);
    const reasons = Object.fromEntries(
      result.recipients.map((r) => [r.patientName, [r.status, r.skipReason]]),
    );
    expect(reasons).toEqual({
      "Gets it": ["SENT", null],
      Started: ["SKIPPED", "IN_CONSULTATION"],
      Cancelled: ["SKIPPED", "VISIT_ENDED"],
      Stale: ["SKIPPED", "CHAT_CLOSED"],
    });
    expect(result.counts).toMatchObject({
      total: 4,
      sent: 1,
      skipped: 3,
      seen: 0,
    });

    // Seen once the patient opens the chat.
    await readPatient(
      post(),
      params({ publicTokenId: t.ok.publicTokenId, channel: "reception" }),
    );
    const seen = await detail(summary.id);
    expect(seen.counts.seen).toBe(1);
    expect(seen.recipients.find((r) => r.patientName === "Gets it")!.seen).toBe(
      true,
    );
    // Out of the way of the next announcements in this clinic.
    for (const token of [t.ok, t.started, t.stale]) {
      await setStatus(token.tokenId, {
        status: "COMPLETED",
        completedAt: new Date(),
      });
    }
  });

  it("delivers each patient exactly once with several processors at once", async () => {
    const fresh = await createClinicFixture();
    try {
      const freshStaff = (await loadStaffMember(
        fresh.receptionist.id,
        fresh.clinic.id,
      ))!;
      const patients = [];
      for (let i = 0; i < 45; i += 1)
        patients.push(await joinAs(fresh, `Patient ${i}`));
      const { summary } = await createBroadcast(freshStaff, {
        idempotencyKey: crypto.randomUUID(),
        body: "We are back from lunch.",
        serviceIds: [],
      });

      const results = await Promise.all([
        processPendingBroadcasts({ broadcastId: summary.id }),
        processPendingBroadcasts({ broadcastId: summary.id }),
        processPendingBroadcasts({ broadcastId: summary.id }),
      ]);

      expect(results.reduce((sum, r) => sum + r.sent, 0)).toBe(45);
      expect(await announcementCount(summary.id)).toBe(45);
      const perChat = await getDb().message.groupBy({
        by: ["conversationId"],
        where: { broadcastId: summary.id },
        _count: { _all: true },
      });
      expect(perChat).toHaveLength(45);
      expect(perChat.every((row) => row._count._all === 1)).toBe(true);
      const broadcast = await getDb().broadcast.findUniqueOrThrow({
        where: { id: summary.id },
      });
      expect(broadcast.status).toBe("DONE");
    } finally {
      await deleteMessagingFixtures([fresh]);
    }
  });

  it("retries a failing patient on later runs and gives up after 5", async () => {
    const staff = await member(work);
    const failing = await joinAs(work, "Failing");
    const fine = await joinAs(work, "Fine");
    const { summary } = await createBroadcast(staff, {
      idempotencyKey: crypto.randomUUID(),
      body: "Secret announcement text",
      serviceIds: [],
    });
    failingTokens.add(failing.tokenId);
    try {
      const first = await processPendingBroadcasts({ broadcastId: summary.id });
      expect(first).toMatchObject({ sent: 1, retrying: 1, completed: 0 });
      const pending = await getDb().broadcastRecipient.findFirstOrThrow({
        where: { broadcastId: summary.id, tokenId: failing.tokenId },
      });
      expect(pending).toMatchObject({ status: "PENDING", attempts: 1 });

      for (let run = 2; run <= MAX_RECIPIENT_ATTEMPTS; run += 1) {
        await processPendingBroadcasts({ broadcastId: summary.id });
      }
    } finally {
      failingTokens.delete(failing.tokenId);
    }

    const recipient = await getDb().broadcastRecipient.findFirstOrThrow({
      where: { broadcastId: summary.id, tokenId: failing.tokenId },
    });
    expect(recipient.status).toBe("FAILED");
    expect(recipient.attempts).toBe(MAX_RECIPIENT_ATTEMPTS);
    expect(recipient.lastError).toBeTruthy();
    expect(recipient.lastError).not.toContain("Secret announcement");
    // Nothing of the failed attempts was kept.
    expect((await receptionPage(failing.publicTokenId)).messages).toEqual([]);
    expect((await receptionPage(fine.publicTokenId)).messages).toHaveLength(1);
    actAs(work.receptionist);
    expect(await detail(summary.id)).toMatchObject({
      status: "DONE",
      counts: { sent: 1, failed: 1, pending: 0 },
    });
  });
});
