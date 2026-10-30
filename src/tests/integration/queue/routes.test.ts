import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as getTodayQueues } from "@/app/api/clinics/[clinicId]/queues/today/route";
import { GET as getDoctorQueue } from "@/app/api/doctor/queue/route";
import { GET as getPublicClinic } from "@/app/api/public/clinics/[clinicSlug]/route";
import { POST as cancelPublicToken } from "@/app/api/public/tokens/[publicTokenId]/cancel/route";
import { GET as getPublicToken } from "@/app/api/public/tokens/[publicTokenId]/route";
import { POST as callNext } from "@/app/api/queues/[queueId]/call-next/route";
import { POST as closeQueue } from "@/app/api/queues/[queueId]/close/route";
import { POST as pauseQueue } from "@/app/api/queues/[queueId]/pause/route";
import { POST as resumeQueue } from "@/app/api/queues/[queueId]/resume/route";
import {
  GET as getQueueTokens,
  POST as joinQueue,
} from "@/app/api/queues/[queueId]/tokens/route";
import { POST as createWalkIn } from "@/app/api/queues/[queueId]/walk-ins/route";
import { POST as tokenAction } from "@/app/api/tokens/[tokenId]/[action]/route";
import { IDEMPOTENCY_KEY_HEADER } from "@/features/queue/contracts";
import {
  actAs,
  createClinicFixture,
  deleteClinicFixtures,
  type ClinicFixture,
} from "./fixtures";

// Needs the test database with migrations applied (npm run db:deploy).
vi.mock("@/lib/auth/session", () => ({ getSessionUser: vi.fn() }));

let clinic: ClinicFixture;
let other: ClinicFixture;

beforeAll(async () => {
  [clinic, other] = await Promise.all([
    createClinicFixture(),
    createClinicFixture(),
  ]);
});

afterAll(async () => {
  await deleteClinicFixtures([clinic, other]);
});

function params<T>(value: T) {
  return { params: Promise.resolve(value) };
}

function post(body?: unknown, idempotencyKey?: string): Request {
  return new Request("http://test/api", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(idempotencyKey ? { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const get = (url = "http://test/api") => new Request(url);

async function join(patientName?: string) {
  const response = await joinQueue(
    post(patientName ? { patientName } : undefined, crypto.randomUUID()),
    params({ queueId: clinic.queue.id }),
  );
  expect(response.status).toBe(201);
  return (await response.json()).token;
}

describe("public routes", () => {
  it("joins a queue, and replays the same token for a retried key", async () => {
    const key = crypto.randomUUID();
    const first = await joinQueue(
      post({ patientName: "Priya" }, key),
      params({ queueId: clinic.queue.id }),
    );
    const retry = await joinQueue(
      post({ patientName: "Priya" }, key),
      params({ queueId: clinic.queue.id }),
    );

    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    const token = (await first.json()).token;
    expect(token).toMatchObject({ status: "WAITING", serviceName: "General" });
    expect((await retry.json()).token.publicTokenId).toBe(token.publicTokenId);
  });

  it("requires an idempotency key to join", async () => {
    const response = await joinQueue(
      post({}),
      params({ queueId: clinic.queue.id }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 for a malformed or unknown queue", async () => {
    for (const queueId of ["not-a-uuid", crypto.randomUUID()]) {
      const response = await joinQueue(
        post({}, crypto.randomUUID()),
        params({ queueId }),
      );
      expect(response.status).toBe(404);
    }
  });

  it("shows the clinic page with today's queue", async () => {
    const response = await getPublicClinic(
      get(),
      params({ clinicSlug: clinic.clinic.slug }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ slug: clinic.clinic.slug, isOpenNow: true });
    expect(body.services[0].queue).toMatchObject({
      queueId: clinic.queue.id,
      status: "OPEN",
    });
  });

  it("returns 404 for an unknown clinic or token", async () => {
    const clinicResponse = await getPublicClinic(
      get(),
      params({ clinicSlug: "no-such-clinic" }),
    );
    const tokenResponse = await getPublicToken(
      get(),
      params({ publicTokenId: "missing" }),
    );

    expect(clinicResponse.status).toBe(404);
    expect((await tokenResponse.json()).error.code).toBe("TOKEN_NOT_FOUND");
  });

  it("shows token status and lets the patient cancel", async () => {
    const token = await join("Cancel me");

    const status = await getPublicToken(
      get(),
      params({ publicTokenId: token.publicTokenId }),
    );
    expect((await status.json()).token).toMatchObject({ status: "WAITING" });

    const cancelled = await cancelPublicToken(
      post(),
      params({ publicTokenId: token.publicTokenId }),
    );
    expect(cancelled.status).toBe(200);
    expect((await cancelled.json()).token).toMatchObject({
      status: "CANCELLED",
      peopleAhead: null,
    });
  });
});

describe("staff routes", () => {
  it("requires sign-in for the live queue", async () => {
    actAs(null);

    const response = await getQueueTokens(
      get(),
      params({ queueId: clinic.queue.id }),
    );

    expect(response.status).toBe(401);
  });

  it("refuses staff from another clinic", async () => {
    actAs(other.receptionist);

    const view = await getQueueTokens(
      get(),
      params({ queueId: clinic.queue.id }),
    );
    const called = await callNext(post(), params({ queueId: clinic.queue.id }));

    expect(view.status).toBe(403);
    expect(called.status).toBe(403);
  });

  it("runs a token from walk-in to completed consultation", async () => {
    actAs(clinic.receptionist);
    const walkIn = await createWalkIn(
      post({ patientName: "Walk-in" }, crypto.randomUUID()),
      params({ queueId: clinic.queue.id }),
    );
    expect(walkIn.status).toBe(201);

    const view = await getQueueTokens(
      get(),
      params({ queueId: clinic.queue.id }),
    );
    const body = await view.json();
    expect(body.settings).toMatchObject({
      waitTargetMinutes: 20,
      allowRequeue: true,
    });
    expect(body.waiting.length).toBeGreaterThan(0);

    const called = await callNext(post(), params({ queueId: clinic.queue.id }));
    const token = (await called.json()).token;
    expect(token.status).toBe("CALLED");

    // Reception can't start a consultation; doctors can.
    const refused = await tokenAction(
      post(),
      params({ tokenId: token.id, action: "start" }),
    );
    expect(refused.status).toBe(403);

    actAs(clinic.doctor);
    const started = await tokenAction(
      post(),
      params({ tokenId: token.id, action: "start" }),
    );
    expect((await started.json()).token).toMatchObject({
      status: "IN_SERVICE",
      assignedDoctorName: expect.stringContaining("doctor"),
    });

    const doctorQueue = await getDoctorQueue(
      get("http://test/api/doctor/queue"),
      {},
    );
    expect((await doctorQueue.json()).current).toMatchObject({ id: token.id });

    const completed = await tokenAction(
      post(),
      params({ tokenId: token.id, action: "complete" }),
    );
    expect((await completed.json()).token.status).toBe("COMPLETED");
  });

  it("rejects an unknown token action", async () => {
    actAs(clinic.receptionist);

    const response = await tokenAction(
      post(),
      params({ tokenId: crypto.randomUUID(), action: "teleport" }),
    );

    expect(response.status).toBe(400);
  });

  it("pauses and resumes the queue", async () => {
    actAs(clinic.receptionist);

    const paused = await pauseQueue(
      post(),
      params({ queueId: clinic.queue.id }),
    );
    expect((await paused.json()).queue.status).toBe("PAUSED");

    const joinWhilePaused = await joinQueue(
      post({}, crypto.randomUUID()),
      params({ queueId: clinic.queue.id }),
    );
    expect((await joinWhilePaused.json()).error.code).toBe("QUEUE_PAUSED");

    const resumed = await resumeQueue(
      post(),
      params({ queueId: clinic.queue.id }),
    );
    expect((await resumed.json()).queue.status).toBe("OPEN");
  });

  it("closes a queue for the day, which can't be resumed", async () => {
    // Closing can't be undone, so this uses its own clinic.
    const closing = await createClinicFixture();
    try {
      actAs(closing.receptionist);

      const closed = await closeQueue(
        post(),
        params({ queueId: closing.queue.id }),
      );
      expect((await closed.json()).queue.status).toBe("CLOSED");

      const joinWhileClosed = await joinQueue(
        post({}, crypto.randomUUID()),
        params({ queueId: closing.queue.id }),
      );
      expect((await joinWhileClosed.json()).error.code).toBe("QUEUE_CLOSED");

      const resumed = await resumeQueue(
        post(),
        params({ queueId: closing.queue.id }),
      );
      expect(resumed.status).toBe(409);
    } finally {
      await deleteClinicFixtures([closing]);
    }
  });

  it("lists today's queues for the clinic", async () => {
    actAs(clinic.receptionist);

    const response = await getTodayQueues(
      get(),
      params({ clinicId: clinic.clinic.id }),
    );

    expect((await response.json()).queues).toMatchObject([
      { queueId: clinic.queue.id, tokenPrefix: "A", status: "OPEN" },
    ]);
  });
});
