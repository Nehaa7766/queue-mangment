import type { Prisma } from "@/generated/prisma/client";
import type { TokenStatus } from "@/generated/prisma/enums";
import type { StaffTokenView } from "@/features/queue/contracts";
import { requireClinicPermission } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { clinicDate, clinicTime, toDbDate } from "./clinic-time";
import { activityKind, buildDashboard, type DashboardView } from "./dashboard";

// Read models for the reception dashboard, history and token details.
// Each function loads the clinic or token first, then authorizes against
// that record's clinic (never a clinic ID taken from the request).

const RECENT_ACTIVITY_LIMIT = 8;
const QUEUE_ACTIVITY_PREFIXES = ["token.", "consultation.", "queue."];
const DAY_MS = 24 * 60 * 60 * 1000;

async function loadClinic(clinicId: string) {
  const clinic = await getDb().clinic.findUnique({
    where: { id: clinicId },
    select: { id: true, name: true, timezone: true, waitTargetMinutes: true },
  });
  if (!clinic) {
    throw new AppError("CLINIC_NOT_FOUND", "This clinic could not be found.");
  }
  await requireClinicPermission(clinic.id, "queue.view");
  return clinic;
}

export async function getDashboardView(
  clinicId: string,
  now: Date = new Date(),
): Promise<DashboardView> {
  const clinic = await loadClinic(clinicId);
  const db = getDb();
  const queueDate = clinicDate(now, clinic.timezone);

  const queues = await db.queue.findMany({
    where: { clinicId: clinic.id, queueDate: toDbDate(queueDate) },
    select: {
      id: true,
      serviceId: true,
      status: true,
      service: { select: { name: true } },
    },
    orderBy: { service: { name: "asc" } },
  });
  const queueIds = queues.map((queue) => queue.id);

  const [tokens, events] = await Promise.all([
    db.queueToken.findMany({
      where: { queueId: { in: queueIds } },
      select: {
        id: true,
        queueId: true,
        serviceId: true,
        tokenLabel: true,
        patientName: true,
        status: true,
        sortKey: true,
        joinedAt: true,
        calledAt: true,
        completedAt: true,
        skippedAt: true,
        cancelledAt: true,
        service: { select: { name: true } },
      },
    }),
    db.auditEvent.findMany({
      // Last 24 hours rather than the clinic day, so the list isn't empty
      // first thing in the morning.
      where: {
        clinicId: clinic.id,
        createdAt: { gte: new Date(now.getTime() - DAY_MS) },
        // Queue activity only; admin changes (services, staff, settings)
        // have their own feed on the admin dashboard.
        OR: QUEUE_ACTIVITY_PREFIXES.map((prefix) => ({
          action: { startsWith: prefix },
        })),
      },
      orderBy: { createdAt: "desc" },
      take: RECENT_ACTIVITY_LIMIT,
      select: {
        id: true,
        action: true,
        newState: true,
        createdAt: true,
        token: { select: { tokenLabel: true } },
        actor: { select: { name: true } },
      },
    }),
  ]);

  return buildDashboard({
    clinic: { id: clinic.id, name: clinic.name, timezone: clinic.timezone },
    queueDate,
    waitTargetMinutes: clinic.waitTargetMinutes,
    now,
    queues: queues.map((queue) => ({
      queueId: queue.id,
      serviceId: queue.serviceId,
      serviceName: queue.service.name,
      status: queue.status,
    })),
    tokens: tokens.map(({ service, ...token }) => ({
      ...token,
      serviceName: service.name,
    })),
    events: events.map((event) => ({
      id: event.id,
      action: event.action,
      newState: event.newState,
      tokenLabel: event.token?.tokenLabel ?? null,
      actorName: event.actor?.name ?? null,
      createdAt: event.createdAt,
    })),
  });
}

const staffTokenSelect = {
  id: true,
  tokenLabel: true,
  patientName: true,
  status: true,
  joinedAt: true,
  calledAt: true,
  serviceStartedAt: true,
  completedAt: true,
  recallCount: true,
  service: { select: { name: true } },
  assignedDoctor: { select: { name: true } },
} satisfies Prisma.QueueTokenSelect;

type StaffTokenRow = Prisma.QueueTokenGetPayload<{
  select: typeof staffTokenSelect;
}>;

function toStaffTokenView(token: StaffTokenRow): StaffTokenView {
  return {
    id: token.id,
    tokenLabel: token.tokenLabel,
    patientName: token.patientName,
    status: token.status,
    serviceName: token.service.name,
    joinedAt: token.joinedAt.toISOString(),
    calledAt: token.calledAt?.toISOString() ?? null,
    serviceStartedAt: token.serviceStartedAt?.toISOString() ?? null,
    completedAt: token.completedAt?.toISOString() ?? null,
    recallCount: token.recallCount,
    assignedDoctorName: token.assignedDoctor?.name ?? null,
  };
}

export const HISTORY_STATUSES = [
  "WAITING",
  "CALLED",
  "IN_SERVICE",
  "COMPLETED",
  "SKIPPED",
  "CANCELLED",
] as const satisfies readonly TokenStatus[];

export type HistoryFilters = {
  status?: TokenStatus;
  serviceId?: string;
  // Matches the token label or patient name.
  search?: string;
};

export type TokenHistory = {
  queueDate: string;
  services: { serviceId: string; serviceName: string }[];
  tokens: StaffTokenView[];
};

// Today's tokens for the clinic, newest first.
export async function getTokenHistory(
  clinicId: string,
  filters: HistoryFilters = {},
  now: Date = new Date(),
): Promise<TokenHistory> {
  const clinic = await loadClinic(clinicId);
  const db = getDb();
  const queueDate = clinicDate(now, clinic.timezone);
  const search = filters.search?.trim();

  const [queues, tokens] = await Promise.all([
    db.queue.findMany({
      where: { clinicId: clinic.id, queueDate: toDbDate(queueDate) },
      select: { serviceId: true, service: { select: { name: true } } },
      orderBy: { service: { name: "asc" } },
    }),
    db.queueToken.findMany({
      where: {
        clinicId: clinic.id,
        queue: { queueDate: toDbDate(queueDate) },
        status: filters.status,
        serviceId: filters.serviceId,
        ...(search
          ? {
              OR: [
                { tokenLabel: { contains: search, mode: "insensitive" } },
                { patientName: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { joinedAt: "desc" },
      select: staffTokenSelect,
    }),
  ]);

  return {
    queueDate,
    services: queues.map((queue) => ({
      serviceId: queue.serviceId,
      serviceName: queue.service.name,
    })),
    tokens: tokens.map(toStaffTokenView),
  };
}

export type TokenDetails = {
  token: StaffTokenView & { queueDate: string };
  timeline: {
    id: string;
    title: string;
    actorName: string | null;
    time: string;
    createdAt: string;
  }[];
};

// Null when the token doesn't exist.
export async function getTokenDetails(
  tokenId: string,
): Promise<TokenDetails | null> {
  const db = getDb();
  const token = await db.queueToken.findUnique({
    where: { id: tokenId },
    select: {
      ...staffTokenSelect,
      clinicId: true,
      queue: { select: { queueDate: true } },
      clinic: { select: { timezone: true } },
    },
  });
  if (!token) return null;
  await requireClinicPermission(token.clinicId, "queue.view");

  const events = await db.auditEvent.findMany({
    where: { tokenId: token.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      action: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
  });

  return {
    token: {
      ...toStaffTokenView(token),
      queueDate: token.queue.queueDate.toISOString().slice(0, 10),
    },
    timeline: events.map((event) => {
      const actorName = event.actor?.name ?? null;
      return {
        id: event.id,
        title: ACTION_TITLE[activityKind(event.action, actorName)],
        actorName,
        time: clinicTime(event.createdAt, token.clinic.timezone),
        createdAt: event.createdAt.toISOString(),
      };
    }),
  };
}

const ACTION_TITLE: Record<ReturnType<typeof activityKind>, string> = {
  joined: "Joined by QR code",
  walkIn: "Registered as a walk-in",
  called: "Called",
  recalled: "Recalled",
  skipped: "Marked as no-show",
  requeued: "Moved back to the queue",
  cancelled: "Cancelled",
  started: "Consultation started",
  completed: "Consultation completed",
  paused: "Queue paused",
  resumed: "Queue resumed",
  closed: "Queue closed",
  other: "Updated",
};
