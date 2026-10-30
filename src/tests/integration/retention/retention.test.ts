import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as runRetentionRoute } from "@/app/api/internal/retention/run/route";
import {
  clearClinicPatientNames,
  PATIENT_NAMES_CLEARED,
} from "@/features/retention/retention";
import { getDb } from "@/lib/db";

// Needs the test database with migrations applied. Only rows this file
// creates are older than any retention period, so the full job run below
// leaves other test files' data alone.
const SECRET = "retention-test-secret-0123456789abcdef";
process.env.INTERNAL_JOB_SECRET = SECRET;

const DAY_MS = 24 * 60 * 60 * 1000;
const run = crypto.randomUUID().slice(0, 8);
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

type Fixture = Awaited<ReturnType<typeof createClinic>>;
let short: Fixture;
let long: Fixture;

// A clinic with a queue and three tokens: old with a name, recent with a
// name, and old without one.
async function createClinic(label: string, patientDataRetentionDays: number) {
  const db = getDb();
  const clinic = await db.clinic.create({
    data: {
      name: `Retention ${label} ${run}`,
      slug: `retention-${label}-${run}`,
      patientDataRetentionDays,
    },
  });
  const service = await db.service.create({
    data: { clinicId: clinic.id, name: "General", tokenPrefix: "A" },
  });
  const queue = await db.queue.create({
    data: {
      clinicId: clinic.id,
      serviceId: service.id,
      queueDate: daysAgo(40),
    },
  });
  const token = (sequenceNumber: number, joinedAt: Date, name: string | null) =>
    db.queueToken.create({
      data: {
        queueId: queue.id,
        clinicId: clinic.id,
        serviceId: service.id,
        sequenceNumber,
        sortKey: sequenceNumber,
        tokenLabel: `A-${sequenceNumber}`,
        patientName: name,
        status: "COMPLETED",
        joinedAt,
      },
    });
  return {
    clinic,
    old: await token(1, daysAgo(40), "Old patient"),
    recent: await token(2, daysAgo(1), "Recent patient"),
    unnamed: await token(3, daysAgo(40), null),
  };
}

async function patientName(tokenId: string) {
  const token = await getDb().queueToken.findUniqueOrThrow({
    where: { id: tokenId },
    select: { patientName: true },
  });
  return token.patientName;
}

async function retentionEvents(clinicId: string) {
  return getDb().auditEvent.findMany({
    where: { clinicId, action: PATIENT_NAMES_CLEARED },
  });
}

function runJob(authorization: string) {
  return runRetentionRoute(
    new Request("http://test/api/internal/retention/run", {
      method: "POST",
      headers: { authorization },
    }),
    {},
  );
}

beforeAll(async () => {
  // 30 days: the 40-day-old name is expired. 90 days: it is not.
  [short, long] = await Promise.all([
    createClinic("short", 30),
    createClinic("long", 90),
  ]);
});

afterAll(async () => {
  const db = getDb();
  const clinicIds = [short, long].flatMap((f) => (f ? [f.clinic.id] : []));
  await db.auditEvent.deleteMany({ where: { clinicId: { in: clinicIds } } });
  await db.queueToken.deleteMany({ where: { clinicId: { in: clinicIds } } });
  await db.queue.deleteMany({ where: { clinicId: { in: clinicIds } } });
  await db.service.deleteMany({ where: { clinicId: { in: clinicIds } } });
  await db.clinic.deleteMany({ where: { id: { in: clinicIds } } });
  await db.idempotencyRecord.deleteMany({
    where: { scope: { startsWith: `retention-test:${run}` } },
  });
});

describe("clearClinicPatientNames", () => {
  it("clears only names older than the clinic's retention period", async () => {
    const cleared = await clearClinicPatientNames(short.clinic);

    expect(cleared).toBe(1);
    expect(await patientName(short.old.id)).toBeNull();
    expect(await patientName(short.recent.id)).toBe("Recent patient");
  });

  it("leaves a clinic with a longer retention period untouched", async () => {
    expect(await clearClinicPatientNames(long.clinic)).toBe(0);
    expect(await patientName(long.old.id)).toBe("Old patient");
    expect(await retentionEvents(long.clinic.id)).toHaveLength(0);
  });

  it("records one audit event with the count, and nothing on a rerun", async () => {
    expect(await clearClinicPatientNames(short.clinic)).toBe(0);

    const events = await retentionEvents(short.clinic.id);
    expect(events).toHaveLength(1);
    expect(events[0].actorUserId).toBeNull();
    expect(events[0].metadata).toMatchObject({ count: 1, retentionDays: 30 });
  });
});

describe("POST /api/internal/retention/run", () => {
  it("refuses a wrong token without touching any data", async () => {
    const before = await patientName(long.old.id);
    await getDb().clinic.update({
      where: { id: long.clinic.id },
      data: { patientDataRetentionDays: 30 },
    });

    const response = await runJob("Bearer not-the-secret");

    expect(response.status).toBe(401);
    expect(await patientName(long.old.id)).toBe(before);
  });

  it("runs every clinic and deletes stale idempotency records", async () => {
    const db = getDb();
    const stale = await db.idempotencyRecord.create({
      data: {
        scope: `retention-test:${run}:stale`,
        idempotencyKey: crypto.randomUUID(),
        requestFingerprint: "0".repeat(64),
        responseReference: "token",
        createdAt: daysAgo(3),
      },
    });
    const fresh = await db.idempotencyRecord.create({
      data: {
        scope: `retention-test:${run}:fresh`,
        idempotencyKey: crypto.randomUUID(),
        requestFingerprint: "0".repeat(64),
        responseReference: "token",
      },
    });

    const response = await runJob(`Bearer ${SECRET}`);

    expect(response.status).toBe(200);
    const result = await response.json();
    // The long clinic now has a 30-day period too (previous test).
    expect(result.patientNamesCleared).toBeGreaterThanOrEqual(1);
    expect(result.idempotencyRecordsDeleted).toBeGreaterThanOrEqual(1);
    expect(await patientName(long.old.id)).toBeNull();
    expect(await patientName(long.recent.id)).toBe("Recent patient");
    expect(
      await db.idempotencyRecord.findUnique({ where: { id: stale.id } }),
    ).toBeNull();
    expect(
      await db.idempotencyRecord.findUnique({ where: { id: fresh.id } }),
    ).not.toBeNull();
  });
});
