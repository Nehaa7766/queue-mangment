import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getPublicTokenView } from "@/features/queue/queries";
import {
  applyTokenAction,
  callNext,
  changeQueueStatus,
  createWalkIn,
  joinQueue,
} from "@/features/queue/service";
import { requireClinicPermission } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { saveIdempotentResult } from "@/lib/idempotency";
import {
  actAs,
  createClinicFixture,
  deleteClinicFixtures,
  type ClinicFixture,
} from "./fixtures";

// Needs the test database with migrations applied (npm run db:deploy).
vi.mock("@/lib/auth/session", () => ({ getSessionUser: vi.fn() }));
// Wraps the real helper so one test can make the last step of a join fail.
vi.mock("@/lib/idempotency", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/idempotency")>();
  return {
    ...actual,
    saveIdempotentResult: vi.fn(actual.saveIdempotentResult),
  };
});

const fixtures: ClinicFixture[] = [];

async function newClinic(options?: Parameters<typeof createClinicFixture>[0]) {
  const fixture = await createClinicFixture(options);
  fixtures.push(fixture);
  return fixture;
}

async function accessAs(
  fixture: ClinicFixture,
  user: { id: string },
  action: Parameters<typeof requireClinicPermission>[1] = "queue.view",
) {
  actAs(user);
  return requireClinicPermission(fixture.clinic.id, action);
}

function join(fixture: ClinicFixture, patientName?: string) {
  return joinQueue({
    queueId: fixture.queue.id,
    patientName,
    idempotencyKey: crypto.randomUUID(),
  });
}

async function errorCode(promise: Promise<unknown>): Promise<string> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(AppError);
  return (error as AppError).code;
}

afterAll(async () => {
  await deleteClinicFixtures(fixtures);
});

describe("joining", () => {
  let clinic: ClinicFixture;
  beforeAll(async () => {
    clinic = await newClinic();
  });

  it("gives 50 simultaneous joins 50 unique sequence numbers", async () => {
    const results = await Promise.all(
      Array.from({ length: 50 }, (_, index) => join(clinic, `P${index}`)),
    );

    const tokens = await getDb().queueToken.findMany({
      where: { id: { in: results.map((result) => result.tokenId) } },
      select: { sequenceNumber: true, tokenLabel: true },
    });
    const numbers = tokens
      .map((token) => token.sequenceNumber)
      .sort((a, b) => a - b);
    expect(numbers).toEqual(
      Array.from({ length: 50 }, (_, index) => index + 1),
    );
    expect(new Set(tokens.map((token) => token.tokenLabel)).size).toBe(50);
  });

  it("replays the same token for a repeated idempotency key", async () => {
    const idempotencyKey = crypto.randomUUID();
    const input = {
      queueId: clinic.queue.id,
      patientName: "Priya",
      idempotencyKey,
    };

    const first = await joinQueue(input);
    const again = await joinQueue(input);

    expect(first.created).toBe(true);
    expect(again).toEqual({ ...first, created: false });
  });

  it("replays one token when the same key races itself", async () => {
    const input = {
      queueId: clinic.queue.id,
      patientName: "Arjun",
      idempotencyKey: crypto.randomUUID(),
    };

    const results = await Promise.all([joinQueue(input), joinQueue(input)]);

    expect(results[0].tokenId).toBe(results[1].tokenId);
    expect(results.filter((result) => result.created)).toHaveLength(1);
  });

  it("rejects the same key with a different request", async () => {
    const idempotencyKey = crypto.randomUUID();
    await joinQueue({
      queueId: clinic.queue.id,
      patientName: "Sana",
      idempotencyKey,
    });

    expect(
      await errorCode(
        joinQueue({
          queueId: clinic.queue.id,
          patientName: "Someone else",
          idempotencyKey,
        }),
      ),
    ).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("rolls back the token and its audit event when a later step fails", async () => {
    const db = getDb();
    const before = await db.queue.findUniqueOrThrow({
      where: { id: clinic.queue.id },
      select: { nextSequence: true },
    });
    const tokensBefore = await db.queueToken.count({
      where: { queueId: clinic.queue.id },
    });
    const auditBefore = await db.auditEvent.count({
      where: { clinicId: clinic.clinic.id },
    });
    vi.mocked(saveIdempotentResult).mockRejectedValueOnce(
      new Error("disk full"),
    );

    await expect(join(clinic, "Rollback")).rejects.toThrow("disk full");

    expect(
      await db.queueToken.count({ where: { queueId: clinic.queue.id } }),
    ).toBe(tokensBefore);
    expect(
      await db.auditEvent.count({ where: { clinicId: clinic.clinic.id } }),
    ).toBe(auditBefore);
    const after = await db.queue.findUniqueOrThrow({
      where: { id: clinic.queue.id },
      select: { nextSequence: true },
    });
    expect(after.nextSequence).toBe(before.nextSequence);
  });

  it("writes an audit event for each join", async () => {
    const { tokenId } = await join(clinic);

    const events = await getDb().auditEvent.findMany({ where: { tokenId } });
    expect(events).toMatchObject([
      { action: "token.joined", newState: "WAITING", actorUserId: null },
    ]);
  });

  it("rejects joins once the queue is full", async () => {
    const small = await newClinic({ maxQueueSize: 1 });
    await join(small);

    expect(await errorCode(join(small))).toBe("QUEUE_CLOSED");
  });
});

describe("paused and closed queues", () => {
  it("rejects joins and calls while paused, then accepts them after resuming", async () => {
    const clinic = await newClinic();
    await join(clinic);
    const access = await accessAs(
      clinic,
      clinic.receptionist,
      "queue.pauseResume",
    );

    await changeQueueStatus(clinic.queue.id, "pause", access);
    expect(await errorCode(join(clinic))).toBe("QUEUE_PAUSED");
    expect(await errorCode(callNext(clinic.queue.id, access))).toBe(
      "QUEUE_PAUSED",
    );
    expect(
      await errorCode(changeQueueStatus(clinic.queue.id, "pause", access)),
    ).toBe("INVALID_STATE_TRANSITION");

    await changeQueueStatus(clinic.queue.id, "resume", access);
    await expect(join(clinic)).resolves.toMatchObject({ created: true });
  });

  it("rejects joins and changes once closed", async () => {
    const clinic = await newClinic();
    const access = await accessAs(
      clinic,
      clinic.receptionist,
      "queue.pauseResume",
    );

    await changeQueueStatus(clinic.queue.id, "close", access);

    expect(await errorCode(join(clinic))).toBe("QUEUE_CLOSED");
    expect(
      await errorCode(changeQueueStatus(clinic.queue.id, "resume", access)),
    ).toBe("QUEUE_CLOSED");
  });
});

describe("calling", () => {
  it("never gives two simultaneous calls the same token", async () => {
    const clinic = await newClinic();
    await join(clinic, "First");
    await join(clinic, "Second");
    const access = await accessAs(
      clinic,
      clinic.receptionist,
      "queue.callNext",
    );

    const called = await Promise.all([
      callNext(clinic.queue.id, access),
      callNext(clinic.queue.id, access),
    ]);

    expect(new Set(called).size).toBe(2);
  });

  it("lets only one of two simultaneous calls claim the last patient", async () => {
    const clinic = await newClinic();
    await join(clinic, "Only");
    const access = await accessAs(
      clinic,
      clinic.receptionist,
      "queue.callNext",
    );

    const results = await Promise.allSettled([
      callNext(clinic.queue.id, access),
      callNext(clinic.queue.id, access),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect((rejected as PromiseRejectedResult).reason).toMatchObject({
      code: "INVALID_STATE_TRANSITION",
    });
  });

  it("calls in FIFO order and audits the call", async () => {
    const clinic = await newClinic();
    const first = await join(clinic, "First");
    await join(clinic, "Second");
    const access = await accessAs(
      clinic,
      clinic.receptionist,
      "queue.callNext",
    );

    const called = await callNext(clinic.queue.id, access);

    expect(called).toBe(first.tokenId);
    const events = await getDb().auditEvent.findMany({
      where: { tokenId: called, action: "token.called" },
    });
    expect(events).toMatchObject([{ actorUserId: clinic.receptionist.id }]);
  });
});

describe("token actions", () => {
  it("moves a requeued token to the back without changing its label", async () => {
    const clinic = await newClinic();
    const first = await join(clinic, "First");
    await join(clinic, "Second");
    await join(clinic, "Third");
    const access = await accessAs(clinic, clinic.receptionist, "queue.requeue");

    await callNext(clinic.queue.id, access);
    await applyTokenAction(first.tokenId, "skip", access);
    await applyTokenAction(first.tokenId, "requeue", access);

    const view = await getPublicTokenView(first.publicTokenId);
    expect(view).toMatchObject({
      tokenLabel: "A-1",
      status: "WAITING",
      peopleAhead: 2,
    });
  });

  it("keeps a recalled token called and counts the recall", async () => {
    const clinic = await newClinic();
    const { tokenId } = await join(clinic);
    const access = await accessAs(clinic, clinic.receptionist, "queue.recall");
    await callNext(clinic.queue.id, access);

    await applyTokenAction(tokenId, "recall", access);

    expect(
      await getDb().queueToken.findUniqueOrThrow({
        where: { id: tokenId },
        select: { status: true, recallCount: true },
      }),
    ).toEqual({ status: "CALLED", recallCount: 1 });
    expect(
      await getDb().queueToken.count({ where: { queueId: clinic.queue.id } }),
    ).toBe(1);
  });

  it("lets a doctor run one consultation at a time", async () => {
    const clinic = await newClinic();
    const first = await join(clinic, "First");
    const second = await join(clinic, "Second");
    const reception = await accessAs(
      clinic,
      clinic.receptionist,
      "queue.callNext",
    );
    await callNext(clinic.queue.id, reception);
    await callNext(clinic.queue.id, reception);
    const doctor = await accessAs(clinic, clinic.doctor, "consultation.start");

    await applyTokenAction(first.tokenId, "start", doctor);
    expect(
      await errorCode(applyTokenAction(second.tokenId, "start", doctor)),
    ).toBe("INVALID_STATE_TRANSITION");

    const otherDoctor = await accessAs(
      clinic,
      clinic.secondDoctor,
      "consultation.complete",
    );
    expect(
      await errorCode(applyTokenAction(first.tokenId, "complete", otherDoctor)),
    ).toBe("FORBIDDEN");

    await applyTokenAction(first.tokenId, "complete", doctor);
    await applyTokenAction(second.tokenId, "start", doctor);
  });

  it("rejects a transition the token's status doesn't allow", async () => {
    const clinic = await newClinic();
    const { tokenId } = await join(clinic);
    const access = await accessAs(clinic, clinic.receptionist, "queue.skip");

    expect(await errorCode(applyTokenAction(tokenId, "skip", access))).toBe(
      "INVALID_STATE_TRANSITION",
    );
  });

  it("refuses staff from another clinic", async () => {
    const clinic = await newClinic();
    const other = await newClinic();
    const { tokenId } = await join(clinic);
    const outsider = await accessAs(
      other,
      other.receptionist,
      "queue.callNext",
    );

    expect(await errorCode(callNext(clinic.queue.id, outsider))).toBe(
      "FORBIDDEN",
    );
    expect(await errorCode(applyTokenAction(tokenId, "cancel", outsider))).toBe(
      "FORBIDDEN",
    );
    expect(
      await errorCode(
        createWalkIn(
          {
            queueId: clinic.queue.id,
            patientName: "Walk-in",
            idempotencyKey: crypto.randomUUID(),
          },
          outsider,
        ),
      ),
    ).toBe("FORBIDDEN");

    actAs(other.receptionist);
    expect(
      await errorCode(requireClinicPermission(clinic.clinic.id, "queue.view")),
    ).toBe("FORBIDDEN");
  });
});

describe("public token view", () => {
  it("shows people ahead and a rough estimate from the service duration", async () => {
    const clinic = await newClinic({ serviceMinutes: 10 });
    await join(clinic, "First");
    await join(clinic, "Second");
    const third = await join(clinic, "Third");

    const view = await getPublicTokenView(third.publicTokenId);

    // 2 ahead × 10 min = 20 → 15–25 min, rough because nothing is completed yet.
    expect(view).toMatchObject({
      tokenLabel: "A-3",
      status: "WAITING",
      peopleAhead: 2,
      estimate: { minMinutes: 15, maxMinutes: 25, isRough: true },
      queueStatus: "OPEN",
    });
  });

  it("shows no position once the token is called", async () => {
    const clinic = await newClinic();
    const first = await join(clinic);
    const access = await accessAs(
      clinic,
      clinic.receptionist,
      "queue.callNext",
    );
    await callNext(clinic.queue.id, access);

    const view = await getPublicTokenView(first.publicTokenId);

    expect(view).toMatchObject({
      status: "CALLED",
      peopleAhead: null,
      estimate: null,
    });
    expect(view?.calledAt).not.toBeNull();
  });
});

describe("patients join only while the clinic is open", () => {
  async function queueDateOf(clinic: ClinicFixture): Promise<Date> {
    const queue = await getDb().queue.findUniqueOrThrow({
      where: { id: clinic.queue.id },
      select: { queueDate: true },
    });
    return queue.queueDate;
  }

  it("refuses patients on a clinic holiday but still takes walk-ins", async () => {
    const clinic = await newClinic();
    await getDb().clinicHoliday.create({
      data: {
        clinicId: clinic.clinic.id,
        date: await queueDateOf(clinic),
        name: "Test holiday",
      },
    });

    expect(await errorCode(join(clinic))).toBe("QUEUE_CLOSED");

    const access = await accessAs(clinic, clinic.receptionist, "walkIn.create");
    const walkIn = await createWalkIn(
      {
        queueId: clinic.queue.id,
        patientName: "Walk-in",
        idempotencyKey: crypto.randomUUID(),
      },
      access,
    );
    expect(walkIn.created).toBe(true);
  });

  it("refuses patients outside opening hours", async () => {
    const clinic = await newClinic();
    // Hours configured, but none on any day: closed now.
    await getDb().clinic.update({
      where: { id: clinic.clinic.id },
      data: { openingHours: {} },
    });

    expect(await errorCode(join(clinic))).toBe("QUEUE_CLOSED");
  });

  it("refuses patients joining an old queue from yesterday", async () => {
    const clinic = await newClinic();
    const yesterday = await getDb().queue.create({
      data: {
        clinicId: clinic.clinic.id,
        serviceId: clinic.service.id,
        queueDate: new Date((await queueDateOf(clinic)).getTime() - 86_400_000),
      },
    });

    expect(
      await errorCode(
        joinQueue({
          queueId: yesterday.id,
          idempotencyKey: crypto.randomUUID(),
        }),
      ),
    ).toBe("QUEUE_CLOSED");
  });
});
