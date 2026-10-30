import {
  clinicToday,
  fromDbDate,
  toDbDate,
} from "@/features/queue/clinic-time";
import { ensureTodayQueues } from "@/features/queue/service";
import { staffTokenSelect, toStaffTokenView } from "@/features/queue/views";
import { getDb } from "@/lib/db";
import { requireDoctorAccess } from "./access";
import type {
  DoctorHistoryEntry,
  DoctorHistoryView,
  DoctorPanelView,
  DoctorSelfView,
} from "./contracts";

// Read functions for the doctor panel. Each one checks the caller is an
// active doctor first.

const DAY_MS = 86_400_000;
// How many days back the consultation history goes, today included.
const HISTORY_DAYS = 7;
const HISTORY_LIMIT = 200;

export const doctorSelfSelect = {
  availability: true,
  delayMinutes: true,
  availabilityNote: true,
  availabilityUpdatedAt: true,
  user: { select: { name: true } },
} as const;

export function toDoctorSelfView(row: {
  availability: DoctorSelfView["availability"];
  delayMinutes: number;
  availabilityNote: string | null;
  availabilityUpdatedAt: Date | null;
  user: { name: string };
}): DoctorSelfView {
  return {
    name: row.user.name,
    availability: row.availability,
    delayMinutes: row.delayMinutes,
    note: row.availabilityNote,
    updatedAt: row.availabilityUpdatedAt?.toISOString() ?? null,
  };
}

function minutesBetween(start: Date | null, end: Date | null): number | null {
  if (!start || !end) return null;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
}

export async function getDoctorPanelView(
  clinicId?: string,
): Promise<DoctorPanelView> {
  const access = await requireDoctorAccess("queue.view", clinicId);
  const db = getDb();
  const queueDate = await ensureTodayQueues(access.clinic);

  const membership = await db.clinicMembership.findUniqueOrThrow({
    where: { id: access.membershipId },
    select: {
      ...doctorSelfSelect,
      serviceAssignments: { select: { serviceId: true } },
    },
  });
  const assigned = membership.serviceAssignments.map((a) => a.serviceId);
  const services = await db.service.findMany({
    where: {
      clinicId: access.clinicId,
      isActive: true,
      ...(assigned.length > 0 ? { id: { in: assigned } } : {}),
    },
    orderBy: { tokenPrefix: "asc" },
    select: {
      id: true,
      name: true,
      tokenPrefix: true,
      queues: { where: { queueDate }, select: { id: true, status: true } },
    },
  });
  const serviceIds = services.map((service) => service.id);
  const today = {
    clinicId: access.clinicId,
    serviceId: { in: serviceIds },
    queue: { queueDate },
  };

  const [settings, current, called, waiting, inService, completed] =
    await Promise.all([
      db.clinic.findUniqueOrThrow({
        where: { id: access.clinicId },
        select: { waitTargetMinutes: true },
      }),
      // Any day: an unfinished consultation from yesterday still blocks a new
      // one, so the doctor has to see it to complete it.
      db.queueToken.findFirst({
        where: {
          clinicId: access.clinicId,
          status: "IN_SERVICE",
          assignedDoctorId: access.user.userId,
        },
        orderBy: { serviceStartedAt: "asc" },
        select: staffTokenSelect,
      }),
      db.queueToken.findMany({
        where: { ...today, status: "CALLED" },
        orderBy: { calledAt: "asc" },
        select: staffTokenSelect,
      }),
      db.queueToken.findMany({
        where: { ...today, status: "WAITING" },
        orderBy: { sortKey: "asc" },
        select: { ...staffTokenSelect, serviceId: true },
      }),
      db.queueToken.findMany({
        where: { ...today, status: "IN_SERVICE" },
        orderBy: { serviceStartedAt: "asc" },
        select: staffTokenSelect,
      }),
      db.queueToken.findMany({
        where: {
          clinicId: access.clinicId,
          status: "COMPLETED",
          assignedDoctorId: access.user.userId,
          queue: { queueDate },
        },
        orderBy: { completedAt: "desc" },
        select: staffTokenSelect,
      }),
    ]);

  const waitingByService = new Map<string, number>();
  for (const token of waiting) {
    waitingByService.set(
      token.serviceId,
      (waitingByService.get(token.serviceId) ?? 0) + 1,
    );
  }
  const order = new Map(serviceIds.map((id, index) => [id, index]));
  // findMany is already in sortKey order; a stable sort keeps it per service.
  const waitingInOrder = [...waiting].sort(
    (a, b) => order.get(a.serviceId)! - order.get(b.serviceId)!,
  );

  const durations = completed
    .map((token) => minutesBetween(token.serviceStartedAt, token.completedAt))
    .filter((minutes): minutes is number => minutes !== null);

  return {
    clinicId: access.clinicId,
    clinic: access.clinic,
    doctor: toDoctorSelfView(membership),
    services: services.map((service) => ({
      serviceId: service.id,
      name: service.name,
      tokenPrefix: service.tokenPrefix,
      queueId: service.queues[0]?.id ?? null,
      queueStatus: service.queues[0]?.status ?? null,
      waitingCount: waitingByService.get(service.id) ?? 0,
    })),
    assignedOnly: assigned.length > 0,
    current: current ? toStaffTokenView(current) : null,
    called: called.map(toStaffTokenView),
    waiting: waitingInOrder.map(toStaffTokenView),
    waitingCount: waiting.length,
    inService: inService.map(toStaffTokenView),
    completedToday: completed.map(toStaffTokenView),
    seenToday: completed.length,
    averageConsultationMinutes:
      durations.length > 0
        ? Math.round(
            durations.reduce((sum, m) => sum + m, 0) / durations.length,
          )
        : null,
    waitTargetMinutes: settings.waitTargetMinutes,
    generatedAt: new Date().toISOString(),
  };
}

// Just the doctor's availability, for the availability page.
export async function getDoctorAvailability(
  clinicId?: string,
): Promise<{ doctor: DoctorSelfView; timezone: string }> {
  const access = await requireDoctorAccess("queue.view", clinicId);
  const membership = await getDb().clinicMembership.findUniqueOrThrow({
    where: { id: access.membershipId },
    select: doctorSelfSelect,
  });
  return {
    doctor: toDoctorSelfView(membership),
    timezone: access.clinic.timezone,
  };
}

// The doctor's own completed consultations over the last week, newest first.
// Minimal fields only: no medical details are stored at all.
export async function getDoctorHistory(
  clinicId?: string,
): Promise<DoctorHistoryView> {
  const access = await requireDoctorAccess("queue.view", clinicId);
  const today = toDbDate(clinicToday(access.clinic.timezone));
  const since = new Date(today.getTime() - (HISTORY_DAYS - 1) * DAY_MS);

  const tokens = await getDb().queueToken.findMany({
    where: {
      clinicId: access.clinicId,
      status: "COMPLETED",
      assignedDoctorId: access.user.userId,
      queue: { queueDate: { gte: since } },
    },
    orderBy: { completedAt: "desc" },
    take: HISTORY_LIMIT,
    select: {
      id: true,
      tokenLabel: true,
      patientName: true,
      serviceStartedAt: true,
      completedAt: true,
      service: { select: { name: true } },
      queue: { select: { queueDate: true } },
    },
  });

  const days = new Map<string, DoctorHistoryEntry[]>();
  for (const token of tokens) {
    const date = fromDbDate(token.queue.queueDate);
    const entries = days.get(date) ?? [];
    entries.push({
      id: token.id,
      tokenLabel: token.tokenLabel,
      patientName: token.patientName,
      serviceName: token.service.name,
      serviceStartedAt: token.serviceStartedAt?.toISOString() ?? null,
      completedAt: token.completedAt?.toISOString() ?? null,
      durationMinutes: minutesBetween(
        token.serviceStartedAt,
        token.completedAt,
      ),
    });
    days.set(date, entries);
  }

  return {
    timezone: access.clinic.timezone,
    days: [...days]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, entries]) => ({ date, entries })),
    generatedAt: new Date().toISOString(),
  };
}
