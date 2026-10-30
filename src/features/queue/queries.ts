import { z } from "zod";
import { patientDoctorNotice } from "@/features/doctor/availability";
import { isClinicHoliday } from "@/features/clinics/holidays";
import { findServingDoctors } from "@/features/doctor/serving-doctors";
import { requireClinicPermission } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { clinicToday, isOpenNow, toDbDate } from "./clinic-time";
import {
  STAFF_DAY_LIST_LIMIT,
  type PublicClinicView,
  type PublicTokenView,
  type StaffQueueSummary,
  type StaffQueueView,
  type StaffTokenView,
} from "./contracts";
import { ensureTodayQueues } from "./service";
import {
  countWaiting,
  estimateForQueue,
  queueSummarySelect,
  staffTokenSelect,
  toQueueSummary,
  toStaffTokenView,
} from "./views";

// Read functions for Server Components. Screens call these directly instead
// of fetching their own API. Staff queries authorize the caller themselves.

const uuidSchema = z.uuid();

// How many finished tokens the staff view shows.
const RECENT_LIMIT = 20;

// Null when no active clinic has this slug.
//
// Assumption until Phase 0 confirms: today's queues are opened automatically
// (for active services, while the clinic is open) the first time anyone
// looks at the clinic, so reception doesn't have to open them by hand.
export async function getPublicClinicView(
  clinicSlug: string,
): Promise<PublicClinicView | null> {
  const db = getDb();
  const clinic = await db.clinic.findUnique({
    where: { slug: clinicSlug },
    select: {
      id: true,
      name: true,
      slug: true,
      timezone: true,
      address: true,
      openingHours: true,
      status: true,
    },
  });
  if (!clinic || clinic.status !== "ACTIVE") {
    return null;
  }

  const today = clinicToday(clinic.timezone);
  const openNow =
    isOpenNow(clinic.openingHours, clinic.timezone) &&
    !(await isClinicHoliday(clinic.id, today));
  const queueDate = openNow ? await ensureTodayQueues(clinic) : toDbDate(today);

  const services = await db.service.findMany({
    where: { clinicId: clinic.id, isActive: true },
    orderBy: { tokenPrefix: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      tokenPrefix: true,
      estimatedDurationMinutes: true,
      queues: {
        where: { queueDate },
        select: { id: true, status: true },
      },
    },
  });
  const waiting = await countWaiting(
    db,
    services.flatMap((service) => service.queues.map((queue) => queue.id)),
  );

  return {
    name: clinic.name,
    slug: clinic.slug,
    timezone: clinic.timezone,
    address: clinic.address,
    isOpenNow: openNow,
    services: await Promise.all(
      services.map(async (service) => {
        const queue = service.queues[0];
        if (!queue) {
          return { ...serviceFields(service), queue: null };
        }
        const waitingCount = waiting.get(queue.id) ?? 0;
        return {
          ...serviceFields(service),
          queue: {
            queueId: queue.id,
            status: queue.status,
            waitingCount,
            // A new patient would have everyone currently waiting ahead of them.
            estimate: await estimateForQueue(
              db,
              {
                id: queue.id,
                serviceMinutes: service.estimatedDurationMinutes,
              },
              waitingCount,
            ),
          },
        };
      }),
    ),
  };
}

function serviceFields(service: {
  id: string;
  name: string;
  description: string | null;
  tokenPrefix: string;
}) {
  return {
    serviceId: service.id,
    name: service.name,
    description: service.description,
    tokenPrefix: service.tokenPrefix,
  };
}

// Null when the token doesn't exist.
export async function getPublicTokenView(
  publicTokenId: string,
): Promise<PublicTokenView | null> {
  const db = getDb();
  const token = await db.queueToken.findUnique({
    where: { publicTokenId },
    select: {
      publicTokenId: true,
      tokenLabel: true,
      status: true,
      sortKey: true,
      calledAt: true,
      clinicId: true,
      serviceId: true,
      queue: { select: { id: true, status: true } },
      service: { select: { name: true, estimatedDurationMinutes: true } },
      clinic: { select: { name: true, slug: true } },
    },
  });
  if (!token) {
    return null;
  }

  let peopleAhead: number | null = null;
  let estimate: PublicTokenView["estimate"] = null;
  let doctorNotice: PublicTokenView["doctorNotice"] = null;
  if (token.status === "WAITING") {
    const doctors = await findServingDoctors(db, token.clinicId, [
      token.serviceId,
    ]);
    doctorNotice = patientDoctorNotice(
      doctors.get(token.serviceId) ?? [],
      Date.now(),
    );
    // Same rule as position.ts: only waiting tokens with a smaller sortKey count.
    peopleAhead = await db.queueToken.count({
      where: {
        queueId: token.queue.id,
        status: "WAITING",
        sortKey: { lt: token.sortKey },
      },
    });
    estimate = await estimateForQueue(
      db,
      {
        id: token.queue.id,
        serviceMinutes: token.service.estimatedDurationMinutes,
      },
      peopleAhead,
    );
  }

  return {
    publicTokenId: token.publicTokenId,
    tokenLabel: token.tokenLabel,
    status: token.status,
    peopleAhead,
    estimate,
    serviceName: token.service.name,
    clinicName: token.clinic.name,
    clinicSlug: token.clinic.slug,
    queueStatus: token.queue.status,
    calledAt: token.calledAt?.toISOString() ?? null,
    updatedAt: new Date().toISOString(),
    doctorNotice,
  };
}

// Today's queues in the clinic's timezone. Requires queue.view.
export async function getTodayQueues(
  clinicId: string,
): Promise<StaffQueueSummary[]> {
  if (!uuidSchema.safeParse(clinicId).success) {
    throw new AppError("FORBIDDEN", "You don't have access to this clinic.");
  }
  await requireClinicPermission(clinicId, "queue.view");

  const db = getDb();
  const clinic = await db.clinic.findUniqueOrThrow({
    where: { id: clinicId },
    select: { id: true, timezone: true },
  });
  const queueDate = await ensureTodayQueues(clinic);
  const queues = await db.queue.findMany({
    where: { clinicId, queueDate },
    orderBy: { service: { tokenPrefix: "asc" } },
    select: queueSummarySelect,
  });
  const waiting = await countWaiting(
    db,
    queues.map((queue) => queue.id),
  );
  return queues.map((queue) =>
    toQueueSummary(queue, waiting.get(queue.id) ?? 0),
  );
}

// Null when the queue doesn't exist. Requires queue.view on its clinic.
export async function getStaffQueueView(
  queueId: string,
): Promise<StaffQueueView | null> {
  if (!uuidSchema.safeParse(queueId).success) {
    return null;
  }
  const db = getDb();
  const queue = await db.queue.findUnique({
    where: { id: queueId },
    select: {
      ...queueSummarySelect,
      clinicId: true,
      clinic: {
        select: {
          waitTargetMinutes: true,
          gracePeriodSeconds: true,
          allowRequeue: true,
        },
      },
    },
  });
  if (!queue) {
    return null;
  }
  await requireClinicPermission(queue.clinicId, "queue.view");

  const [current, waiting, recent, completed, missed, doctors] =
    await Promise.all([
      db.queueToken.findMany({
        where: { queueId, status: { in: ["CALLED", "IN_SERVICE"] } },
        orderBy: { calledAt: "asc" },
        select: staffTokenSelect,
      }),
      db.queueToken.findMany({
        where: { queueId, status: "WAITING" },
        orderBy: { sortKey: "asc" },
        select: staffTokenSelect,
      }),
      db.queueToken.findMany({
        where: {
          queueId,
          status: { in: ["COMPLETED", "SKIPPED", "CANCELLED"] },
        },
        orderBy: { updatedAt: "desc" },
        take: RECENT_LIMIT,
        select: staffTokenSelect,
      }),
      db.queueToken.findMany({
        where: { queueId, status: "COMPLETED" },
        orderBy: [{ completedAt: "desc" }, { sequenceNumber: "desc" }],
        take: STAFF_DAY_LIST_LIMIT,
        select: staffTokenSelect,
      }),
      db.queueToken.findMany({
        where: { queueId, status: { in: ["SKIPPED", "CANCELLED"] } },
        orderBy: [{ updatedAt: "desc" }, { sequenceNumber: "desc" }],
        take: STAFF_DAY_LIST_LIMIT,
        select: staffTokenSelect,
      }),
      findServingDoctors(db, queue.clinicId, [queue.serviceId]),
    ]);

  return {
    queue: toQueueSummary(queue, waiting.length),
    current: current.map(toStaffTokenView),
    waiting: waiting.map(toStaffTokenView),
    recent: recent.map(toStaffTokenView),
    completedToday: completed.map(toStaffTokenView),
    missedToday: missed.map(toStaffTokenView),
    settings: {
      waitTargetMinutes: queue.clinic.waitTargetMinutes,
      gracePeriodSeconds: queue.clinic.gracePeriodSeconds,
      allowRequeue: queue.clinic.allowRequeue,
    },
    doctors: doctors.get(queue.serviceId) ?? [],
  };
}

// ---- Helpers for route handlers (not part of the screen contract) ----

// Loads a queue's clinic so callers can authorize against the resource
// itself, never against a clinic ID sent by the client. Null if missing.
export async function findQueueClinicId(
  queueId: string,
): Promise<string | null> {
  const queue = await getDb().queue.findUnique({
    where: { id: queueId },
    select: { clinicId: true },
  });
  return queue?.clinicId ?? null;
}

export async function findTokenClinicId(
  tokenId: string,
): Promise<string | null> {
  const token = await getDb().queueToken.findUnique({
    where: { id: tokenId },
    select: { clinicId: true },
  });
  return token?.clinicId ?? null;
}

// Callers must have authorized access to the token's clinic already.
export async function getStaffTokenView(
  tokenId: string,
): Promise<StaffTokenView> {
  const token = await getDb().queueToken.findUniqueOrThrow({
    where: { id: tokenId },
    select: staffTokenSelect,
  });
  return toStaffTokenView(token);
}

// Callers must have authorized access to the queue's clinic already.
export async function getQueueSummary(
  queueId: string,
): Promise<StaffQueueSummary> {
  const db = getDb();
  const queue = await db.queue.findUniqueOrThrow({
    where: { id: queueId },
    select: queueSummarySelect,
  });
  const waiting = await countWaiting(db, [queueId]);
  return toQueueSummary(queue, waiting.get(queueId) ?? 0);
}
