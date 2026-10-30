import type { Prisma } from "@/generated/prisma/client";
import { fromDbDate } from "./clinic-time";
import type { StaffQueueSummary, StaffTokenView } from "./contracts";
import { estimateWait, type WaitEstimate } from "./eta";

// Maps database rows to the contract shapes in contracts.ts.

type Db = Prisma.TransactionClient;

export const staffTokenSelect = {
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

export function toStaffTokenView(row: StaffTokenRow): StaffTokenView {
  return {
    id: row.id,
    tokenLabel: row.tokenLabel,
    patientName: row.patientName,
    status: row.status,
    serviceName: row.service.name,
    joinedAt: row.joinedAt.toISOString(),
    calledAt: row.calledAt?.toISOString() ?? null,
    serviceStartedAt: row.serviceStartedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    recallCount: row.recallCount,
    assignedDoctorName: row.assignedDoctor?.name ?? null,
  };
}

export const queueSummarySelect = {
  id: true,
  serviceId: true,
  status: true,
  queueDate: true,
  service: { select: { name: true, tokenPrefix: true } },
} satisfies Prisma.QueueSelect;

type QueueSummaryRow = Prisma.QueueGetPayload<{
  select: typeof queueSummarySelect;
}>;

export function toQueueSummary(
  row: QueueSummaryRow,
  waitingCount: number,
): StaffQueueSummary {
  return {
    queueId: row.id,
    serviceId: row.serviceId,
    serviceName: row.service.name,
    tokenPrefix: row.service.tokenPrefix,
    status: row.status,
    queueDate: fromDbDate(row.queueDate),
    waitingCount,
  };
}

// Waiting-token counts for several queues in one query.
export async function countWaiting(
  db: Db,
  queueIds: readonly string[],
): Promise<Map<string, number>> {
  if (queueIds.length === 0) {
    return new Map();
  }
  const groups = await db.queueToken.groupBy({
    by: ["queueId"],
    where: { queueId: { in: [...queueIds] }, status: "WAITING" },
    _count: { _all: true },
  });
  return new Map(groups.map((group) => [group.queueId, group._count._all]));
}

// How many recent consultations feed the median in estimateWait.
const RECENT_SAMPLES = 20;

// Wait estimate for someone with `peopleAhead` patients in front of them,
// using this queue's completed consultations and the doctors serving it now.
export async function estimateForQueue(
  db: Db,
  queue: { id: string; serviceMinutes: number },
  peopleAhead: number,
): Promise<WaitEstimate> {
  const [completed, serving] = await Promise.all([
    db.queueToken.findMany({
      where: {
        queueId: queue.id,
        status: "COMPLETED",
        serviceStartedAt: { not: null },
        completedAt: { not: null },
      },
      orderBy: { completedAt: "desc" },
      take: RECENT_SAMPLES,
      select: { serviceStartedAt: true, completedAt: true },
    }),
    db.queueToken.findMany({
      where: {
        queueId: queue.id,
        status: "IN_SERVICE",
        assignedDoctorId: { not: null },
      },
      distinct: ["assignedDoctorId"],
      select: { assignedDoctorId: true },
    }),
  ]);

  return estimateWait({
    peopleAhead,
    serviceMinutes: queue.serviceMinutes,
    recentDurationsMinutes: completed.map(
      (token) =>
        (token.completedAt!.getTime() - token.serviceStartedAt!.getTime()) /
        60_000,
    ),
    activeDoctors: serving.length,
  });
}
