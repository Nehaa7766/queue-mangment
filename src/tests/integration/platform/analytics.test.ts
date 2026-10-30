import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getPlatformAnalytics } from "@/features/platform/analytics";
import { dayKey } from "@/features/platform/analytics-shape";
import { getPlatformDashboard } from "@/features/platform/dashboard";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import {
  actAs,
  cleanUp,
  createActiveClinic,
  createUser,
  createdTracker,
} from "./fixtures";

// Needs the test database migrated. Every figure is limited to this file's
// own clinic (the clinicIds option), so other runs can't change the numbers.
vi.mock("@/lib/auth/session", () => ({ getSessionUser: vi.fn() }));

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const SECRET_NAME = "Patient Secret Name";

const created = createdTracker();
let admin: { id: string };
let clinic: Awaited<ReturnType<typeof createActiveClinic>>;

beforeAll(async () => {
  const db = getDb();
  const now = Date.now();
  const at = (offset: number) => new Date(now - offset);
  admin = await createUser(created, "analytics-admin", "SUPER_ADMIN");
  clinic = await createActiveClinic(created);
  const clinicId = clinic.clinic.id;

  await db.platformAuditEvent.create({
    data: {
      actorUserId: admin.id,
      action: "clinic.activated",
      targetType: "clinic",
      targetId: clinicId,
    },
  });

  const service = await db.service.create({
    data: { clinicId, name: "General", tokenPrefix: "A" },
  });
  const queueOn = (offset: number) =>
    db.queue.create({
      data: {
        clinicId,
        serviceId: service.id,
        queueDate: new Date(`${dayKey(at(offset))}T00:00:00.000Z`),
      },
    });
  const today = await queueOn(0);
  const earlier = await queueOn(40 * DAY);
  let sequence = 0;
  const token = (data: Record<string, unknown>, queueId = today.id) => {
    sequence += 1;
    return db.queueToken.create({
      data: {
        queueId,
        clinicId,
        serviceId: service.id,
        sequenceNumber: sequence,
        sortKey: sequence,
        tokenLabel: `A-${sequence}`,
        patientName: SECRET_NAME,
        ...data,
      },
    });
  };
  // Today: two served (waited 10 and 20 minutes), one no-show (waited 1),
  // one still waiting.
  await token({
    status: "COMPLETED",
    joinedAt: at(30 * MINUTE),
    calledAt: at(20 * MINUTE),
    completedAt: at(10 * MINUTE),
  });
  await token({
    status: "COMPLETED",
    joinedAt: at(25 * MINUTE),
    calledAt: at(5 * MINUTE),
    completedAt: at(1 * MINUTE),
  });
  await token({
    status: "SKIPPED",
    joinedAt: at(15 * MINUTE),
    calledAt: at(14 * MINUTE),
    skippedAt: at(2 * MINUTE),
  });
  await token({ status: "WAITING", joinedAt: at(1 * MINUTE) });
  // 40 days ago: outside 30 days, inside 90.
  await token(
    {
      status: "COMPLETED",
      joinedAt: at(40 * DAY + 30 * MINUTE),
      calledAt: at(40 * DAY + 20 * MINUTE),
      completedAt: at(40 * DAY),
    },
    earlier.id,
  );
});

afterAll(async () => {
  const db = getDb();
  const clinicIds = created.clinicIds;
  await db.queueToken.deleteMany({ where: { clinicId: { in: clinicIds } } });
  await db.queue.deleteMany({ where: { clinicId: { in: clinicIds } } });
  await cleanUp(created);
});

describe("platform analytics", () => {
  const options = () => ({ clinicIds: [clinic.clinic.id] });

  it("tracks sign-ups, approvals and active clinics", async () => {
    actAs(admin, "SUPER_ADMIN");

    const analytics = await getPlatformAnalytics(7, new Date(), options());

    expect(analytics.growth.totals).toEqual({
      signups: 1,
      approved: 1,
      suspended: 0,
      activeNow: 1,
    });
    expect(analytics.growth.points).toHaveLength(7);
    expect(analytics.growth.points.at(-1)?.active).toBe(1);
  });

  it("counts tokens issued and served on the range's queue days", async () => {
    actAs(admin, "SUPER_ADMIN");

    const week = await getPlatformAnalytics(7, new Date(), options());
    const quarter = await getPlatformAnalytics(90, new Date(), options());

    expect(week.tokens).toEqual({ issued: 4, served: 2 });
    expect(quarter.tokens).toEqual({ issued: 5, served: 3 });
  });

  it("never returns patient names", async () => {
    actAs(admin, "SUPER_ADMIN");

    const analytics = await getPlatformAnalytics(90, new Date(), options());

    expect(JSON.stringify(analytics)).not.toContain(SECRET_NAME);
  });

  it("returns zeros for an empty clinic list", async () => {
    actAs(admin, "SUPER_ADMIN");

    const analytics = await getPlatformAnalytics(30, new Date(), {
      clinicIds: [],
    });

    expect(analytics.growth.totals.signups).toBe(0);
    expect(analytics.tokens).toEqual({ issued: 0, served: 0 });
  });

  it("is for super admins only", async () => {
    actAs(clinic.staff);
    await expect(getPlatformAnalytics(30)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    actAs(null);
    await expect(getPlatformAnalytics(30)).rejects.toBeInstanceOf(AppError);
  });
});

describe("platform dashboard figures", () => {
  it("counts clinics and tickets in progress", async () => {
    actAs(admin, "SUPER_ADMIN");

    const dashboard = await getPlatformDashboard();

    expect(dashboard.ticketsInProgress).toBeLessThanOrEqual(
      dashboard.openTickets,
    );
    expect(dashboard.clinics.total).toBeGreaterThanOrEqual(
      dashboard.clinics.active,
    );
  });
});
