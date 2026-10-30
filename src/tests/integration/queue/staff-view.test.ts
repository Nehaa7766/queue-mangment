import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { TokenStatus } from "@/generated/prisma/enums";
import { STAFF_DAY_LIST_LIMIT } from "@/features/queue/contracts";
import { getStaffQueueView } from "@/features/queue/queries";
import { getDb } from "@/lib/db";
import {
  actAs,
  createClinicFixture,
  deleteClinicFixtures,
  type ClinicFixture,
} from "./fixtures";

// Needs the test database with migrations applied (npm run db:deploy).
vi.mock("@/lib/auth/session", () => ({ getSessionUser: vi.fn() }));

const DAY_MS = 24 * 60 * 60 * 1000;
const fixtures: ClinicFixture[] = [];

let clinic: ClinicFixture;
let yesterdayQueueId: string;

// Minutes ago from the start of the test, so the order is unambiguous.
const start = Date.now();
const ago = (minutes: number) => new Date(start - minutes * 60_000);

let sequence = 0;
async function token(
  queueId: string,
  status: TokenStatus,
  times: {
    serviceStartedAt?: Date;
    completedAt?: Date;
    updatedAt?: Date;
  } = {},
) {
  sequence += 1;
  return getDb().queueToken.create({
    data: {
      queueId,
      clinicId: clinic.clinic.id,
      serviceId: clinic.service.id,
      sequenceNumber: sequence,
      sortKey: sequence,
      tokenLabel: `A-${sequence}`,
      patientName: `Patient ${sequence}`,
      status,
      assignedDoctorId: times.serviceStartedAt ? clinic.doctor.id : null,
      calledAt: status === "WAITING" ? null : ago(90),
      ...times,
    },
    select: { id: true },
  });
}

const ids = (tokens: { id: string }[]) => tokens.map((t) => t.id);

let today: Record<string, { id: string }>;
let yesterday: { id: string }[];

beforeAll(async () => {
  clinic = await createClinicFixture();
  fixtures.push(clinic);
  const { queueDate } = await getDb().queue.findUniqueOrThrow({
    where: { id: clinic.queue.id },
    select: { queueDate: true },
  });
  const yesterdayQueue = await getDb().queue.create({
    data: {
      clinicId: clinic.clinic.id,
      serviceId: clinic.service.id,
      queueDate: new Date(queueDate.getTime() - DAY_MS),
    },
  });
  yesterdayQueueId = yesterdayQueue.id;

  today = {
    waiting: await token(clinic.queue.id, "WAITING"),
    inService: await token(clinic.queue.id, "IN_SERVICE", {
      serviceStartedAt: ago(5),
    }),
    completedFirst: await token(clinic.queue.id, "COMPLETED", {
      serviceStartedAt: ago(60),
      completedAt: ago(48),
    }),
    completedLast: await token(clinic.queue.id, "COMPLETED", {
      serviceStartedAt: ago(30),
      completedAt: ago(20),
    }),
    skipped: await token(clinic.queue.id, "SKIPPED", { updatedAt: ago(40) }),
    cancelled: await token(clinic.queue.id, "CANCELLED", {
      updatedAt: ago(10),
    }),
  };
  // Yesterday's queue for the same service, finished more recently than
  // anything today, so ordering alone can't hide them.
  yesterday = [
    await token(yesterdayQueueId, "COMPLETED", {
      serviceStartedAt: ago(4),
      completedAt: ago(1),
    }),
    await token(yesterdayQueueId, "SKIPPED", { updatedAt: ago(1) }),
    await token(yesterdayQueueId, "CANCELLED", { updatedAt: ago(1) }),
  ];
});

afterAll(async () => {
  await deleteClinicFixtures(fixtures);
});

describe("getStaffQueueView day lists", () => {
  it("returns today's completed tokens, newest first, with the doctor and times", async () => {
    actAs(clinic.receptionist);
    const view = (await getStaffQueueView(clinic.queue.id))!;

    expect(ids(view.completedToday)).toEqual([
      today.completedLast.id,
      today.completedFirst.id,
    ]);
    expect(view.completedToday[0]).toMatchObject({
      status: "COMPLETED",
      assignedDoctorName: `doctor ${clinic.run}`,
      serviceStartedAt: ago(30).toISOString(),
      completedAt: ago(20).toISOString(),
    });
  });

  it("returns today's no-shows and cancellations, newest first", async () => {
    actAs(clinic.receptionist);
    const view = (await getStaffQueueView(clinic.queue.id))!;

    expect(ids(view.missedToday)).toEqual([
      today.cancelled.id,
      today.skipped.id,
    ]);
    expect(view.missedToday.map((t) => t.status)).toEqual([
      "CANCELLED",
      "SKIPPED",
    ]);
  });

  it("leaves out yesterday's tokens and patients still in the queue", async () => {
    actAs(clinic.receptionist);
    const view = (await getStaffQueueView(clinic.queue.id))!;
    const listed = ids([...view.completedToday, ...view.missedToday]);

    for (const id of ids(yesterday)) {
      expect(listed).not.toContain(id);
    }
    expect(listed).not.toContain(today.waiting.id);
    expect(listed).not.toContain(today.inService.id);
    expect(ids(view.waiting)).toEqual([today.waiting.id]);
    expect(ids(view.current)).toEqual([today.inService.id]);
  });

  it(`caps each list at ${STAFF_DAY_LIST_LIMIT}`, async () => {
    const busy = await createClinicFixture();
    fixtures.push(busy);
    await getDb().queueToken.createMany({
      data: Array.from({ length: STAFF_DAY_LIST_LIMIT + 1 }, (_, i) => ({
        queueId: busy.queue.id,
        clinicId: busy.clinic.id,
        serviceId: busy.service.id,
        sequenceNumber: i + 1,
        sortKey: i + 1,
        tokenLabel: `A-${i + 1}`,
        status: "COMPLETED" as const,
        completedAt: ago(STAFF_DAY_LIST_LIMIT + 1 - i),
      })),
    });

    actAs(busy.receptionist);
    const view = (await getStaffQueueView(busy.queue.id))!;

    expect(view.completedToday).toHaveLength(STAFF_DAY_LIST_LIMIT);
    // The oldest one is the one left out.
    expect(view.completedToday[0].tokenLabel).toBe(
      `A-${STAFF_DAY_LIST_LIMIT + 1}`,
    );
    expect(view.completedToday.at(-1)!.tokenLabel).toBe("A-2");
  });
});
