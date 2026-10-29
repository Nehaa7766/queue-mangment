import { AppError } from "@/lib/errors/app-error";

// Same names as the Prisma QueueStatus enum (Phase 2 schema).
export const QUEUE_STATUSES = ["OPEN", "PAUSED", "CLOSED"] as const;

export type QueueStatus = (typeof QUEUE_STATUSES)[number];

// Assumption until Phase 0 confirms: a paused queue keeps its waiting
// patients but takes no new joins; a closed queue takes nothing.
export function assertCanJoin(input: {
  queueStatus: QueueStatus;
  serviceActive: boolean;
  waitingCount: number;
  // null means the clinic has set no limit.
  maxQueueSize: number | null;
}): void {
  const { queueStatus, serviceActive, waitingCount, maxQueueSize } = input;

  if (queueStatus === "CLOSED") {
    throw new AppError("QUEUE_CLOSED", "This queue is closed.");
  }
  if (queueStatus === "PAUSED") {
    throw new AppError("QUEUE_PAUSED", "This queue is temporarily paused.");
  }
  // To a patient, a disabled service or a full queue looks the same as a closed one.
  if (!serviceActive) {
    throw new AppError(
      "QUEUE_CLOSED",
      "This service is not taking patients right now.",
    );
  }
  if (maxQueueSize !== null && waitingCount >= maxQueueSize) {
    throw new AppError(
      "QUEUE_CLOSED",
      "This queue is full. Please ask at reception.",
    );
  }
}

export function assertCanCallNext(queueStatus: QueueStatus): void {
  if (queueStatus === "CLOSED") {
    throw new AppError("QUEUE_CLOSED", "This queue is closed.");
  }
  if (queueStatus === "PAUSED") {
    throw new AppError(
      "QUEUE_PAUSED",
      "Resume the queue before calling the next patient.",
    );
  }
}

// Assumption until Phase 0 confirms: a doctor runs one consultation at a time.
export function assertDoctorFree(activeConsultationCount: number): void {
  if (activeConsultationCount > 0) {
    throw new AppError(
      "INVALID_STATE_TRANSITION",
      "Finish the current consultation before starting another.",
    );
  }
}
