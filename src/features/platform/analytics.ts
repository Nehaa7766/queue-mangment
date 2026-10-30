import { requirePlatformAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import {
  dayKey,
  querySince,
  rangeDays,
  shapeClinicGrowth,
  type AnalyticsRange,
  type ClinicGrowth,
} from "./analytics-shape";
import { ACTIVATED_ACTION, SUSPENDED_ACTION } from "./lifecycle";

// Platform-wide figures for the super-admin dashboard. Clinic records and
// token counts only; nothing that identifies a patient.

export type PlatformAnalytics = {
  range: AnalyticsRange;
  days: string[];
  growth: ClinicGrowth;
  // Tokens on queues dated within the range, across every clinic.
  tokens: { issued: number; served: number };
};

type Options = {
  // Limits every figure to these clinics. Used by tests, which share the
  // database with other runs; the dashboard looks at every clinic.
  clinicIds?: readonly string[];
};

async function queryGrowth(
  since: Date,
  days: string[],
  clinicIds: readonly string[] | undefined,
): Promise<ClinicGrowth> {
  const db = getDb();
  const clinicWhere = clinicIds ? { id: { in: [...clinicIds] } } : {};
  const eventWhere = clinicIds ? { targetId: { in: [...clinicIds] } } : {};
  const [created, events, activeNow] = await Promise.all([
    db.clinic.findMany({
      where: { ...clinicWhere, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    db.platformAuditEvent.findMany({
      where: {
        ...eventWhere,
        targetType: "clinic",
        action: { in: [ACTIVATED_ACTION, SUSPENDED_ACTION] },
        createdAt: { gte: since },
      },
      select: { action: true, createdAt: true },
    }),
    db.clinic.count({ where: { ...clinicWhere, status: "ACTIVE" } }),
  ]);
  const daysOf = (action: string) =>
    events
      .filter((event) => event.action === action)
      .map((event) => dayKey(event.createdAt));
  return shapeClinicGrowth({
    days,
    signupDays: created.map((clinic) => dayKey(clinic.createdAt)),
    approvalDays: daysOf(ACTIVATED_ACTION),
    suspensionDays: daysOf(SUSPENDED_ACTION),
    activeNow,
  });
}

// Queue days are each clinic's own dates, so no timezone maths is needed.
async function queryTokens(
  days: string[],
  clinicIds: readonly string[] | undefined,
): Promise<PlatformAnalytics["tokens"]> {
  const db = getDb();
  const where = {
    ...(clinicIds && { clinicId: { in: [...clinicIds] } }),
    queue: {
      queueDate: {
        gte: new Date(`${days[0]}T00:00:00.000Z`),
        lte: new Date(`${days[days.length - 1]}T00:00:00.000Z`),
      },
    },
  };
  const [issued, served] = await Promise.all([
    db.queueToken.count({ where }),
    db.queueToken.count({ where: { ...where, status: "COMPLETED" } }),
  ]);
  return { issued, served };
}

export async function getPlatformAnalytics(
  range: AnalyticsRange,
  now: Date = new Date(),
  options: Options = {},
): Promise<PlatformAnalytics> {
  await requirePlatformAdmin();
  const days = rangeDays(range, now);
  const since = querySince(range, now);
  const [growth, tokens] = await Promise.all([
    queryGrowth(since, days, options.clinicIds),
    queryTokens(days, options.clinicIds),
  ]);
  return { range, days, growth, tokens };
}
