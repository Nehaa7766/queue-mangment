import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as staffEvents } from "@/app/api/messages/events/route";
import { POST as sendStaffMessage } from "@/app/api/messages/conversations/[conversationId]/messages/route";
import { POST as readStaff } from "@/app/api/messages/conversations/[conversationId]/read/route";
import { GET as patientEvents } from "@/app/api/public/tokens/[publicTokenId]/messages/events/route";
import { POST as sendPatientMessage } from "@/app/api/public/tokens/[publicTokenId]/messages/[channel]/route";
import { POST as readPatient } from "@/app/api/public/tokens/[publicTokenId]/messages/[channel]/read/route";
import { loadStaffMember } from "@/features/messaging/access";
import { createBroadcast } from "@/features/messaging/broadcasts";
import type { MessagingEvent } from "@/features/messaging/contracts";
import { MAX_STREAMS_PER_TOKEN } from "@/features/messaging/limits";
import {
  openStreamCount,
  stopMessagingListener,
} from "@/features/messaging/live";
import { getDb } from "@/lib/db";
import {
  actAs,
  addDoctor,
  addService,
  createClinicFixture,
  deleteMessagingFixtures,
  expectError,
  joinAs,
  params,
  post,
  startVisit,
  type ClinicFixture,
  type Staff,
} from "./fixtures";

// Needs the test database with migrations applied (npm run db:deploy).
vi.mock("@/lib/auth/session", () => ({ getSessionUser: vi.fn() }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
  after: () => {},
}));

let clinic: ClinicFixture;
let other: ClinicFixture;
let pediatrics: { id: string; queueId: string };
let pediatrician: Staff;
let generalOnly: Staff;

beforeAll(async () => {
  [clinic, other] = await Promise.all([
    createClinicFixture(),
    createClinicFixture(),
  ]);
  pediatrics = await addService(clinic, "Pediatrics", "P");
  pediatrician = await addDoctor(clinic, "peds", [pediatrics.id]);
  generalOnly = await addDoctor(clinic, "general", [clinic.service.id]);
});

afterAll(async () => {
  await stopMessagingListener();
  await deleteMessagingFixtures([clinic, other]);
});

const WAIT_MS = 5_000;

type Stream = {
  response: Response;
  // Text received so far, including comments.
  text: () => string;
  // Resolves with the next `messaging` event, or null after `ms`.
  next: (ms?: number) => Promise<MessagingEvent | null>;
  close: () => void;
};

// Reads an event stream in the background and hands out events in order.
async function open(
  handler: (request: Request) => Promise<Response>,
): Promise<Stream> {
  const abort = new AbortController();
  const response = await handler(
    new Request("http://test/api/events", { signal: abort.signal }),
  );
  let text = "";
  const events: MessagingEvent[] = [];
  if (response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    void (async () => {
      for (;;) {
        const { done, value } = await reader
          .read()
          .catch(() => ({ done: true, value: undefined }));
        if (done) break;
        text += decoder.decode(value, { stream: true });
        const blocks = text.split("\n\n");
        events.length = 0;
        for (const block of blocks) {
          const data = block.match(/^event: messaging\ndata: (.*)$/m);
          if (data) events.push(JSON.parse(data[1]));
        }
      }
    })();
  }
  let taken = 0;
  return {
    response,
    text: () => text,
    next: async (ms = WAIT_MS) => {
      const deadline = Date.now() + ms;
      while (events.length <= taken && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      return events.length > taken ? events[taken++] : null;
    },
    close: () => abort.abort(),
  };
}

function patientStream(publicTokenId: string) {
  return open((request) => patientEvents(request, params({ publicTokenId })));
}

function staffStream(staff: { id: string }) {
  actAs(staff);
  return open((request) => staffEvents(request, {}));
}

function patientSend(publicTokenId: string, channel = "reception") {
  return sendPatientMessage(
    post({ clientMessageId: crypto.randomUUID(), body: "Message text" }),
    params({ publicTokenId, channel }),
  );
}

async function conversationId(
  tokenId: string,
  channel: "RECEPTION" | "DOCTOR",
) {
  const row = await getDb().conversation.findUniqueOrThrow({
    where: { tokenId_channel: { tokenId, channel } },
  });
  return row.id;
}

describe("patient stream", () => {
  it("is a Server-Sent Events stream that flushes at once", async () => {
    const token = await joinAs(clinic);
    const stream = await patientStream(token.publicTokenId);

    expect(stream.response.status).toBe(200);
    expect(stream.response.headers.get("content-type")).toBe(
      "text/event-stream; charset=utf-8",
    );
    expect(stream.response.headers.get("cache-control")).toBe(
      "no-cache, no-transform",
    );
    expect(stream.response.headers.get("x-accel-buffering")).toBe("no");
    await stream.next(300);
    expect(stream.text()).toContain("retry: 3000\n\n: connected\n\n");
    stream.close();
  });

  it("gets hints for its own chats, never the text, and not its own reads", async () => {
    const mine = await joinAs(clinic, "Mine");
    const theirs = await joinAs(clinic, "Theirs");
    const stream = await patientStream(mine.publicTokenId);

    await patientSend(theirs.publicTokenId);
    expect(await stream.next(800)).toBeNull();

    await patientSend(mine.publicTokenId);
    const id = await conversationId(mine.tokenId, "RECEPTION");
    expect(await stream.next()).toEqual({
      type: "message",
      conversationId: id,
      channel: "RECEPTION",
    });

    actAs(clinic.receptionist);
    await sendStaffMessage(
      post({ clientMessageId: crypto.randomUUID(), body: "Reply" }),
      params({ conversationId: id }),
    );
    expect(await stream.next()).toEqual({
      type: "message",
      conversationId: id,
      channel: "RECEPTION",
    });

    await readPatient(
      post(),
      params({ publicTokenId: mine.publicTokenId, channel: "reception" }),
    );
    expect(await stream.next(800)).toBeNull();
    expect(stream.text()).not.toContain("Message text");
    expect(stream.text()).not.toContain("Reply");
    stream.close();
  });

  it("allows 3 open streams per token link", async () => {
    const token = await joinAs(clinic);
    const key = `token:${token.tokenId}`;
    const streams = [];
    for (let i = 0; i < MAX_STREAMS_PER_TOKEN; i += 1) {
      streams.push(await patientStream(token.publicTokenId));
    }
    expect(openStreamCount(key)).toBe(3);

    await expectError(
      await patientEvents(
        new Request("http://test"),
        params({ publicTokenId: token.publicTokenId }),
      ),
      429,
      "RATE_LIMITED",
    );

    streams[0].close();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(openStreamCount(key)).toBe(2);
    const replacement = await patientStream(token.publicTokenId);
    expect(replacement.response.status).toBe(200);
    for (const stream of [...streams.slice(1), replacement]) stream.close();
  });

  it("returns 404 for an unknown token link", async () => {
    await expectError(
      await patientEvents(
        new Request("http://test"),
        params({ publicTokenId: crypto.randomUUID() }),
      ),
      404,
      "TOKEN_NOT_FOUND",
    );
  });
});

describe("staff stream", () => {
  it("needs a staff session", async () => {
    actAs(null);
    await expectError(
      await staffEvents(new Request("http://test"), {}),
      401,
      "UNAUTHENTICATED",
    );
  });

  it("follows the routing rule for each staff member", async () => {
    const reception = await staffStream(clinic.receptionist);
    const peds = await staffStream(pediatrician);
    const general = await staffStream(generalOnly);
    const elsewhere = await staffStream(other.receptionist);

    const child = await joinAs(clinic, "Child", pediatrics.queueId);
    await patientSend(child.publicTokenId, "doctor");
    const doctorChat = await conversationId(child.tokenId, "DOCTOR");
    expect(await peds.next()).toEqual({
      type: "message",
      conversationId: doctorChat,
      channel: "DOCTOR",
    });

    await patientSend(child.publicTokenId, "reception");
    const receptionChat = await conversationId(child.tokenId, "RECEPTION");
    expect(await reception.next()).toEqual({
      type: "message",
      conversationId: receptionChat,
      channel: "RECEPTION",
    });

    // Neither the reception chat nor another service's doctor chat.
    expect(await general.next(500)).toBeNull();
    expect(await peds.next(500)).toBeNull();
    expect(await elsewhere.next(300)).toBeNull();

    // A staff read reaches the patient's side, not other staff.
    actAs(clinic.receptionist);
    await readStaff(post(), params({ conversationId: receptionChat }));
    expect(await reception.next(500)).toBeNull();

    // When another doctor starts the visit, the doctor who loses the chat
    // gets a hint to refetch.
    await startVisit(clinic, child.tokenId, clinic.doctor);
    expect(await peds.next()).toEqual({
      type: "conversation",
      conversationId: doctorChat,
      channel: "DOCTOR",
    });
    expect(await general.next(500)).toBeNull();

    for (const stream of [reception, peds, general, elsewhere]) stream.close();
  });

  it("tells reception about announcement progress, not doctors", async () => {
    await joinAs(clinic, "Listener");
    const reception = await staffStream(clinic.admin);
    const doctor = await staffStream(clinic.secondDoctor);
    const member = (await loadStaffMember(
      clinic.receptionist.id,
      clinic.clinic.id,
    ))!;

    const { summary } = await createBroadcast(member, {
      idempotencyKey: crypto.randomUUID(),
      body: "Announcement",
      serviceIds: [],
    });

    expect(await reception.next()).toEqual({
      type: "broadcast",
      broadcastId: summary.id,
    });
    expect(await doctor.next(500)).toBeNull();
    reception.close();
    doctor.close();
    await getDb().broadcast.delete({ where: { id: summary.id } });
  });
});
