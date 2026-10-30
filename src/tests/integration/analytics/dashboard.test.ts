import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { clinicDate, toDbDate } from "@/features/analytics/clinic-time";
import {
  getDashboardView,
  getTokenDetails,
  getTokenHistory,
} from "@/features/analytics/queries";
import { getSessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";

// Needs the test database with migrations applied (npm run db:deploy).
vi.mock("@/lib/auth/session", () => ({ getSessionUser: vi.fn() }));

const TZ = "Asia/Kolkata";
const run = crypto.randomUUID().slice(0, 8);
const now = new Date();
const minutesAgo = (minutes: number) =>
  new Date(now.getTime() - minutes * 60_000);
const ids = {} as {
  clinic: string;
  otherClinic: string;
  user: string;
  skippedToken: string;
};

beforeAll(async () => {
  const db = getDb();
  const [clinic, otherClinic] = await Promise.all([
    db.clinic.create({
      data: {
        name: "Analytics Clinic",
        slug: `analytics-${run}`,
        timezone: TZ,
      },
    }),
    db.clinic.create({
      data: {
        name: "Other Clinic",
        slug: `analytics-other-${run}`,
        timezone: TZ,
      },
    }),
  ]);
  const user = await db.user.create({
    data: {
      name: "Reception Analytics",
      email: `analytics-${run}@example.test`,
    },
  });
  await db.clinicMembership.create({
    data: { clinicId: clinic.id, userId: user.id, role: "RECEPTIONIST" },
  });
  const service = await db.service.create({
    data: { clinicId: clinic.id, name: "General", tokenPrefix: "A" },
  });
  const queue = await db.queue.create({
    data: {
      clinicId: clinic.id,
      serviceId: service.id,
      queueDate: toDbDate(clinicDate(now, TZ)),
      nextSequence: 5,
    },
  });

  const base = {
    queueId: queue.id,
    clinicId: clinic.id,
    serviceId: service.id,
  };
  const [, skipped] = await Promise.all([
    // Waited 20 minutes, then served.
    db.queueToken.create({
      data: {
        ...base,
        sequenceNumber: 1,
        sortKey: 1,
        tokenLabel: "A-1",
        patientName: "Asha",
        status: "COMPLETED",
        joinedAt: minutesAgo(60),
        calledAt: minutesAgo(40),
        completedAt: minutesAgo(30),
      },
    }),
    // Waited 30 minutes, then a no-show.
    db.queueToken.create({
      data: {
        ...base,
        sequenceNumber: 2,
        sortKey: 2,
        tokenLabel: "A-2",
        patientName: "Bilal",
        status: "SKIPPED",
        joinedAt: minutesAgo(50),
        calledAt: minutesAgo(20),
        skippedAt: minutesAgo(15),
      },
    }),
    db.queueToken.create({
      data: {
        ...base,
        sequenceNumber: 3,
        sortKey: 3,
        tokenLabel: "A-3",
        patientName: "Chitra",
        joinedAt: minutesAgo(10),
      },
    }),
    db.queueToken.create({
      data: {
        ...base,
        sequenceNumber: 4,
        sortKey: 4,
        tokenLabel: "A-4",
        patientName: "Dev",
        joinedAt: minutesAgo(5),
      },
    }),
  ]);
  await db.auditEvent.createMany({
    data: [
      {
        clinicId: clinic.id,
        queueId: queue.id,
        tokenId: skipped.id,
        actorUserId: user.id,
        action: "token.called",
        createdAt: minutesAgo(20),
      },
      {
        clinicId: clinic.id,
        queueId: queue.id,
        tokenId: skipped.id,
        actorUserId: user.id,
        action: "token.skipped",
        createdAt: minutesAgo(15),
      },
      {
        clinicId: clinic.id,
        queueId: queue.id,
        actorUserId: user.id,
        action: "queue.paused",
        createdAt: minutesAgo(1),
      },
    ],
  });

  Object.assign(ids, {
    clinic: clinic.id,
    otherClinic: otherClinic.id,
    user: user.id,
    skippedToken: skipped.id,
  });
  vi.mocked(getSessionUser).mockResolvedValue({
    userId: user.id,
    platformRole: null,
  });
});

afterAll(async () => {
  const db = getDb();
  const clinicIds = [ids.clinic, ids.otherClinic];
  await db.auditEvent.deleteMany({ where: { clinicId: { in: clinicIds } } });
  await db.queueToken.deleteMany({ where: { clinicId: { in: clinicIds } } });
  await db.queue.deleteMany({ where: { clinicId: { in: clinicIds } } });
  await db.service.deleteMany({ where: { clinicId: { in: clinicIds } } });
  await db.clinicMembership.deleteMany({ where: { userId: ids.user } });
  await db.user.deleteMany({ where: { id: ids.user } });
  await db.clinic.deleteMany({ where: { id: { in: clinicIds } } });
});

describe("getDashboardView", () => {
  it("summarises today's queue for the clinic", async () => {
    const view = await getDashboardView(ids.clinic, now);

    expect(view.kpis).toMatchObject({
      waitingNow: 2,
      servedToday: 1,
      averageWaitMinutes: 25,
      noShowsToday: 1,
    });
    expect(view.waitingByService).toEqual([
      expect.objectContaining({ serviceName: "General", waiting: 2 }),
    ]);
    expect(view.flow.at(-1)?.waiting).toBe(2);
    expect(view.queueCard?.upNext.map((token) => token.tokenLabel)).toEqual([
      "A-3",
      "A-4",
    ]);
  });

  it("lists recent activity newest first, with names", async () => {
    const view = await getDashboardView(ids.clinic, now);

    expect(view.recentActivity.map((item) => item.kind)).toEqual([
      "paused",
      "skipped",
      "called",
    ]);
    expect(view.recentActivity[1].detail).toBe("A-2 · Reception Analytics");
  });

  it("refuses staff from another clinic", async () => {
    const error = await getDashboardView(ids.otherClinic, now).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("FORBIDDEN");
  });

  it("reports an unknown clinic", async () => {
    const error = await getDashboardView(crypto.randomUUID(), now).catch(
      (caught: unknown) => caught,
    );

    expect((error as AppError).code).toBe("CLINIC_NOT_FOUND");
  });
});

describe("getTokenHistory", () => {
  it("filters today's tokens by status and search", async () => {
    const skipped = await getTokenHistory(
      ids.clinic,
      { status: "SKIPPED" },
      now,
    );
    expect(skipped.tokens.map((token) => token.tokenLabel)).toEqual(["A-2"]);

    const byName = await getTokenHistory(ids.clinic, { search: "chit" }, now);
    expect(byName.tokens.map((token) => token.tokenLabel)).toEqual(["A-3"]);

    const all = await getTokenHistory(ids.clinic, {}, now);
    // Newest first.
    expect(all.tokens.map((token) => token.tokenLabel)).toEqual([
      "A-4",
      "A-3",
      "A-2",
      "A-1",
    ]);
  });
});

describe("getTokenDetails", () => {
  it("returns the token with its audit timeline", async () => {
    const details = await getTokenDetails(ids.skippedToken);

    expect(details?.token).toMatchObject({
      tokenLabel: "A-2",
      status: "SKIPPED",
    });
    expect(details?.timeline.map((event) => event.title)).toEqual([
      "Called",
      "Marked as no-show",
    ]);
  });

  it("returns null for an unknown token", async () => {
    expect(await getTokenDetails(crypto.randomUUID())).toBeNull();
  });
});
