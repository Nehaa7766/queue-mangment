import type { Prisma } from "@/generated/prisma/client";
import type { MembershipRole } from "@/generated/prisma/enums";
import { requireClinicPermission } from "@/lib/auth/guards";
import type { Action } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import {
  buildAdminAnalytics,
  RANGE_DAYS,
  type AdminAnalyticsView,
  type AnalyticsRange,
} from "./admin-analytics";
import { describeAction, type AuditCategory } from "./audit-log";
import { clinicDate, clinicTime, toDbDate } from "./clinic-time";
import { addDays, clinicDayBounds, daysEndingOn } from "./range-time";

// Read models for the clinic admin panel. Each loads the clinic first, then
// checks the caller's permission on that clinic.

async function loadClinic(clinicId: string, action: Action) {
  const clinic = await getDb().clinic.findUnique({
    where: { id: clinicId },
    select: {
      id: true,
      name: true,
      slug: true,
      timezone: true,
      openingHours: true,
    },
  });
  if (!clinic) {
    throw new AppError("CLINIC_NOT_FOUND", "This clinic could not be found.");
  }
  await requireClinicPermission(clinic.id, action);
  return clinic;
}

// ---- Analytics ----

export async function getAdminAnalytics(
  clinicId: string,
  range: AnalyticsRange,
  now: Date = new Date(),
): Promise<AdminAnalyticsView & { clinicName: string; timezone: string }> {
  const clinic = await loadClinic(clinicId, "analytics.view");
  const today = clinicDate(now, clinic.timezone);
  const days = daysEndingOn(today, RANGE_DAYS[range]);

  const tokens = await getDb().queueToken.findMany({
    where: {
      clinicId: clinic.id,
      queue: { queueDate: { gte: toDbDate(days[0]), lte: toDbDate(today) } },
    },
    select: {
      serviceId: true,
      status: true,
      createdByUserId: true,
      joinedAt: true,
      calledAt: true,
      serviceStartedAt: true,
      completedAt: true,
      service: { select: { name: true } },
      queue: { select: { queueDate: true } },
    },
  });

  const view = buildAdminAnalytics({
    range,
    today,
    tokens: tokens.map((token) => ({
      queueDate: token.queue.queueDate.toISOString().slice(0, 10),
      serviceId: token.serviceId,
      serviceName: token.service.name,
      status: token.status,
      walkIn: token.createdByUserId !== null,
      joinedAt: token.joinedAt,
      calledAt: token.calledAt,
      serviceStartedAt: token.serviceStartedAt,
      completedAt: token.completedAt,
    })),
  });
  return { ...view, clinicName: clinic.name, timezone: clinic.timezone };
}

// ---- Audit log ----

export type AuditFilters = {
  // YYYY-MM-DD in the clinic's timezone.
  date?: string;
  actorUserId?: string;
  category?: AuditCategory;
};

export type AuditEntry = {
  id: string;
  action: string;
  label: string;
  actorName: string | null;
  tokenLabel: string | null;
  previousState: string | null;
  newState: string | null;
  createdAt: string;
  date: string;
  time: string;
};

export type AuditLog = {
  timezone: string;
  entries: AuditEntry[];
  // Everyone who has been a member, for the staff filter.
  actors: { userId: string; name: string }[];
  // True when more than `limit` entries match; narrow the filters to see them.
  truncated: boolean;
};

const AUDIT_LIMIT = 200;

export async function getAuditLog(
  clinicId: string,
  filters: AuditFilters,
): Promise<AuditLog> {
  const clinic = await loadClinic(clinicId, "audit.view");
  const db = getDb();

  const where: Prisma.AuditEventWhereInput = { clinicId: clinic.id };
  if (filters.date) {
    const { start, end } = clinicDayBounds(filters.date, clinic.timezone);
    where.createdAt = { gte: start, lt: end };
  }
  if (filters.actorUserId) where.actorUserId = filters.actorUserId;
  if (filters.category) where.action = { startsWith: `${filters.category}.` };

  const [events, members] = await Promise.all([
    db.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: AUDIT_LIMIT + 1,
      select: {
        id: true,
        action: true,
        previousState: true,
        newState: true,
        createdAt: true,
        actor: { select: { name: true } },
        token: { select: { tokenLabel: true } },
      },
    }),
    db.clinicMembership.findMany({
      where: { clinicId: clinic.id },
      orderBy: { user: { name: "asc" } },
      select: { user: { select: { id: true, name: true } } },
    }),
  ]);

  return {
    timezone: clinic.timezone,
    entries: events.slice(0, AUDIT_LIMIT).map((event) => ({
      id: event.id,
      action: event.action,
      label: describeAction(event.action),
      actorName: event.actor?.name ?? null,
      tokenLabel: event.token?.tokenLabel ?? null,
      previousState: event.previousState,
      newState: event.newState,
      createdAt: event.createdAt.toISOString(),
      date: clinicDate(event.createdAt, clinic.timezone),
      time: clinicTime(event.createdAt, clinic.timezone),
    })),
    actors: members.map((member) => ({
      userId: member.user.id,
      name: member.user.name,
    })),
    truncated: events.length > AUDIT_LIMIT,
  };
}

// ---- Overview for the admin dashboard ----

export type AdminOverview = {
  clinic: { id: string; name: string; slug: string; timezone: string };
  today: string;
  setup: {
    hasOpeningHours: boolean;
    activeServices: number;
    inactiveServices: number;
    staffByRole: Record<MembershipRole, number>;
    pendingInvitations: number;
    upcomingHolidays: { date: string; name: string }[];
  };
  doctors: {
    name: string;
    availability: "AVAILABLE" | "ON_BREAK" | "OFF_DUTY";
    delayMinutes: number;
  }[];
  // Setting and staff changes; queue activity lives on the reception dashboard.
  recentChanges: AuditEntry[];
};

const ADMIN_CATEGORIES: AuditCategory[] = ["service", "staff", "clinic"];

export async function getAdminOverview(
  clinicId: string,
  now: Date = new Date(),
): Promise<AdminOverview> {
  const clinic = await loadClinic(clinicId, "clinic.settings");
  const db = getDb();
  const today = clinicDate(now, clinic.timezone);

  const [services, members, invitations, holidays, changes] = await Promise.all(
    [
      db.service.groupBy({
        by: ["isActive"],
        where: { clinicId: clinic.id },
        _count: true,
      }),
      db.clinicMembership.findMany({
        where: { clinicId: clinic.id, status: "ACTIVE" },
        select: {
          role: true,
          availability: true,
          delayMinutes: true,
          user: { select: { name: true } },
        },
      }),
      db.staffInvitation.count({
        where: {
          clinicId: clinic.id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
      }),
      db.clinicHoliday.findMany({
        where: {
          clinicId: clinic.id,
          date: { gte: toDbDate(today), lte: toDbDate(addDays(today, 60)) },
        },
        orderBy: { date: "asc" },
        take: 3,
        select: { date: true, name: true },
      }),
      db.auditEvent.findMany({
        where: {
          clinicId: clinic.id,
          OR: ADMIN_CATEGORIES.map((category) => ({
            action: { startsWith: `${category}.` },
          })),
        },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          action: true,
          previousState: true,
          newState: true,
          createdAt: true,
          actor: { select: { name: true } },
        },
      }),
    ],
  );

  const staffByRole: Record<MembershipRole, number> = {
    RECEPTIONIST: 0,
    DOCTOR: 0,
    CLINIC_ADMIN: 0,
  };
  for (const member of members) staffByRole[member.role] += 1;

  return {
    clinic: {
      id: clinic.id,
      name: clinic.name,
      slug: clinic.slug,
      timezone: clinic.timezone,
    },
    today,
    setup: {
      hasOpeningHours:
        clinic.openingHours !== null && typeof clinic.openingHours === "object",
      activeServices: services.find((group) => group.isActive)?._count ?? 0,
      inactiveServices: services.find((group) => !group.isActive)?._count ?? 0,
      staffByRole,
      pendingInvitations: invitations,
      upcomingHolidays: holidays.map((holiday) => ({
        date: holiday.date.toISOString().slice(0, 10),
        name: holiday.name,
      })),
    },
    doctors: members
      .filter((member) => member.role === "DOCTOR")
      .map((member) => ({
        name: member.user.name,
        availability: member.availability,
        delayMinutes: member.delayMinutes,
      })),
    recentChanges: changes.map((event) => ({
      id: event.id,
      action: event.action,
      label: describeAction(event.action),
      actorName: event.actor?.name ?? null,
      tokenLabel: null,
      previousState: event.previousState,
      newState: event.newState,
      createdAt: event.createdAt.toISOString(),
      date: clinicDate(event.createdAt, clinic.timezone),
      time: clinicTime(event.createdAt, clinic.timezone),
    })),
  };
}
