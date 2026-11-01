import { Prisma } from "@/generated/prisma/client";
import { recordAudit } from "@/features/audit/record-audit";
import { onTokenChangedForMessaging } from "@/features/messaging/token-hooks";
import type { ClinicAccess } from "@/lib/auth/guards";
import { assertSameClinic } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import {
  findIdempotentResult,
  fingerprintRequest,
  saveIdempotentResult,
  type IdempotencyInput,
} from "@/lib/idempotency";
import { clinicToday, isOpenNow, toDbDate } from "./clinic-time";
import type { StaffTokenAction } from "./contracts";
import { queueNotFound, tokenChanged, tokenNotFound } from "./errors";
import {
  assertCanCallNext,
  assertCanJoin,
  assertDoctorFree,
  type QueueStatus,
} from "./queue-rules";
import { formatTokenLabel } from "./token-label";
import { assertAction } from "./token-status";

// Queue writes (docs/PLAN.md §9–§10). Each runs in one transaction together
// with its audit event. Callers authorize first; these functions trust the
// ClinicAccess they are given but still check the token belongs to it.
// Outbox events are not written yet: nothing consumes them until Phase 8.

type Tx = Prisma.TransactionClient;

// Patients can join only today's queue, while the clinic is open and not on
// a holiday. An old link to yesterday's queue must not add anyone to it.
// Reads through the transaction: a second pooled connection per join would
// exhaust the pool under load.
async function assertOpenForPatients(
  tx: Tx,
  queue: {
    clinicId: string;
    queueDate: Date;
    clinic: { openingHours: Prisma.JsonValue; timezone: string };
  },
): Promise<void> {
  const today = toDbDate(clinicToday(queue.clinic.timezone));
  const holiday = await tx.clinicHoliday.findUnique({
    where: { clinicId_date: { clinicId: queue.clinicId, date: today } },
    select: { id: true },
  });
  const open =
    queue.queueDate.getTime() === today.getTime() &&
    isOpenNow(queue.clinic.openingHours, queue.clinic.timezone) &&
    !holiday;
  if (!open) {
    throw new AppError(
      "QUEUE_CLOSED",
      "This clinic isn't taking new patients right now.",
    );
  }
}

// ---- Today's queues ----

// Creates any missing queue rows for today (clinic timezone) for the clinic's
// active services. Safe to call concurrently: duplicates are skipped.
export async function ensureTodayQueues(clinic: {
  id: string;
  timezone: string;
}): Promise<Date> {
  const db = getDb();
  const queueDate = toDbDate(clinicToday(clinic.timezone));
  const services = await db.service.findMany({
    where: { clinicId: clinic.id, isActive: true },
    select: { id: true },
  });
  if (services.length > 0) {
    await db.queue.createMany({
      data: services.map((service) => ({
        clinicId: clinic.id,
        serviceId: service.id,
        queueDate,
      })),
      skipDuplicates: true,
    });
  }
  return queueDate;
}

export async function getOrCreateTodayQueue(
  serviceId: string,
): Promise<{ id: string; clinicId: string; status: QueueStatus }> {
  const db = getDb();
  const service = await db.service.findUnique({
    where: { id: serviceId },
    select: { clinicId: true, clinic: { select: { timezone: true } } },
  });
  if (!service) {
    throw queueNotFound();
  }
  const queueDate = toDbDate(clinicToday(service.clinic.timezone));
  await db.queue.createMany({
    data: [{ clinicId: service.clinicId, serviceId, queueDate }],
    skipDuplicates: true,
  });
  return db.queue.findUniqueOrThrow({
    where: { serviceId_queueDate: { serviceId, queueDate } },
    select: { id: true, clinicId: true, status: true },
  });
}

// ---- Joining ----

const JOIN_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 10_000 };

export type JoinInput = {
  queueId: string;
  patientName?: string;
  idempotencyKey: string;
};

export type JoinResult = {
  tokenId: string;
  publicTokenId: string;
  // False when an earlier request with the same idempotency key is replayed.
  created: boolean;
};

// A patient joins after explicitly confirming (docs/PLAN.md §9 rules 1–3).
export function joinQueue(input: JoinInput): Promise<JoinResult> {
  return createToken(input, null);
}

// Reception registers a walk-in patient.
export function createWalkIn(
  input: JoinInput,
  access: ClinicAccess,
): Promise<JoinResult> {
  return createToken(input, access);
}

async function createToken(
  input: JoinInput,
  access: ClinicAccess | null,
): Promise<JoinResult> {
  const db = getDb();
  const idempotency: IdempotencyInput = {
    scope: `queue:${input.queueId}:${access ? "walk-in" : "join"}`,
    key: input.idempotencyKey,
    fingerprint: fingerprintRequest({ patientName: input.patientName ?? null }),
  };

  try {
    return await db.$transaction(async (tx) => {
      const replayed = await findIdempotentResult(tx, idempotency);
      if (replayed) {
        return { ...(await loadTokenIds(tx, replayed)), created: false };
      }

      const queue = await tx.queue.findUnique({
        where: { id: input.queueId },
        select: {
          clinicId: true,
          serviceId: true,
          queueDate: true,
          service: { select: { tokenPrefix: true, isActive: true } },
          clinic: {
            select: { maxQueueSize: true, openingHours: true, timezone: true },
          },
        },
      });
      if (!queue) {
        throw queueNotFound();
      }
      if (access) {
        assertSameClinic(queue.clinicId, access);
      } else {
        // Reception may register walk-ins at any time; patients only join.
        await assertOpenForPatients(tx, queue);
      }

      // Locks the queue row until commit, so joins on one queue are serialized
      // from here and the waiting count below is exact.
      const sequence = await allocateSequence(tx, input.queueId);
      const waitingCount = await tx.queueToken.count({
        where: { queueId: input.queueId, status: "WAITING" },
      });
      assertCanJoin({
        queueStatus: sequence.status,
        serviceActive: queue.service.isActive,
        waitingCount,
        maxQueueSize: queue.clinic.maxQueueSize,
      });

      const token = await tx.queueToken.create({
        data: {
          queueId: input.queueId,
          clinicId: queue.clinicId,
          serviceId: queue.serviceId,
          sequenceNumber: sequence.value,
          sortKey: sequence.value,
          tokenLabel: formatTokenLabel(
            queue.service.tokenPrefix,
            sequence.value,
          ),
          patientName: input.patientName ?? null,
          createdByUserId: access?.user.userId ?? null,
        },
        select: { id: true, publicTokenId: true },
      });
      await recordAudit(tx, {
        clinicId: queue.clinicId,
        queueId: input.queueId,
        tokenId: token.id,
        actorUserId: access?.user.userId ?? null,
        action: access ? "token.walk_in_registered" : "token.joined",
        newState: "WAITING",
      });
      await saveIdempotentResult(tx, {
        ...idempotency,
        responseReference: token.id,
      });

      return {
        tokenId: token.id,
        publicTokenId: token.publicTokenId,
        created: true,
      };
      // Joins on one queue run one at a time, so a burst may wait longer than
      // Prisma's 2-second default for a pooled connection.
    }, JOIN_TRANSACTION_OPTIONS);
  } catch (error) {
    // Two requests with the same key raced and this one lost on the unique
    // (scope, key) constraint: replay the winner's token instead of failing.
    if (isUniqueViolation(error)) {
      const replayed = await db.$transaction((tx) =>
        findIdempotentResult(tx, idempotency),
      );
      if (replayed) {
        return { ...(await loadTokenIds(db, replayed)), created: false };
      }
    }
    throw error;
  }
}

async function loadTokenIds(
  tx: Tx,
  tokenId: string,
): Promise<{ tokenId: string; publicTokenId: string }> {
  const token = await tx.queueToken.findUniqueOrThrow({
    where: { id: tokenId },
    select: { publicTokenId: true },
  });
  return { tokenId, publicTokenId: token.publicTokenId };
}

// Takes the next value from the queue's counter. The UPDATE row-locks the
// queue until the transaction ends; the returned status is read under that lock.
async function allocateSequence(
  tx: Tx,
  queueId: string,
): Promise<{ value: number; status: QueueStatus }> {
  const rows = await tx.$queryRaw<{ value: number; status: QueueStatus }[]>`
    UPDATE queues
    SET next_sequence = next_sequence + 1
    WHERE id = ${queueId}::uuid
    RETURNING next_sequence - 1 AS value, status::text AS status`;
  if (rows.length === 0) {
    throw queueNotFound();
  }
  return rows[0];
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

// ---- Calling ----

// Claims the next waiting token (FIFO by sortKey). Returns its id.
export async function callNext(
  queueId: string,
  access: ClinicAccess,
): Promise<string> {
  return getDb().$transaction(async (tx) => {
    // FOR SHARE makes a concurrent pause or close wait for this call to finish.
    const [queue] = await tx.$queryRaw<
      { clinicId: string; status: QueueStatus }[]
    >`
      SELECT clinic_id::text AS "clinicId", status::text AS status
      FROM queues WHERE id = ${queueId}::uuid
      FOR SHARE`;
    if (!queue) {
      throw queueNotFound();
    }
    assertSameClinic(queue.clinicId, access);
    assertCanCallNext(queue.status);

    // SKIP LOCKED: two receptionists pressing Call next at the same moment
    // claim different tokens instead of the same one. Timestamps are stored
    // as UTC without a zone, like the ones Prisma writes.
    const [claimed] = await tx.$queryRaw<{ id: string }[]>`
      UPDATE queue_tokens
      SET status = 'CALLED',
        called_at = now() AT TIME ZONE 'UTC',
        updated_at = now() AT TIME ZONE 'UTC'
      WHERE id = (
        SELECT id FROM queue_tokens
        WHERE queue_id = ${queueId}::uuid AND status = 'WAITING'
        ORDER BY sort_key
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id::text AS id`;
    if (!claimed) {
      throw new AppError(
        "INVALID_STATE_TRANSITION",
        "No patients are waiting.",
      );
    }

    await recordAudit(tx, {
      clinicId: queue.clinicId,
      queueId,
      tokenId: claimed.id,
      actorUserId: access.user.userId,
      action: "token.called",
      previousState: "WAITING",
      newState: "CALLED",
    });
    return claimed.id;
  });
}

// ---- Token actions ----

const AUDIT_ACTIONS: Record<StaffTokenAction, string> = {
  recall: "token.recalled",
  skip: "token.skipped",
  requeue: "token.requeued",
  cancel: "token.cancelled",
  start: "consultation.started",
  complete: "consultation.completed",
};

// Recall, skip, requeue, cancel, start or complete one token.
export async function applyTokenAction(
  tokenId: string,
  action: StaffTokenAction,
  access: ClinicAccess,
): Promise<void> {
  await getDb().$transaction(async (tx) => {
    const token = await tx.queueToken.findUnique({
      where: { id: tokenId },
      select: {
        status: true,
        clinicId: true,
        queueId: true,
        assignedDoctorId: true,
        clinic: { select: { allowRequeue: true } },
      },
    });
    if (!token) {
      throw tokenNotFound();
    }
    assertSameClinic(token.clinicId, access);
    const nextStatus = assertAction(action, token.status, {
      allowRequeue: token.clinic.allowRequeue,
    });
    const data = await buildActionUpdate(tx, action, token, access);

    // Only succeeds if nobody changed the token since we read it.
    const { count } = await tx.queueToken.updateMany({
      where: { id: tokenId, status: token.status },
      data,
    });
    if (count === 0) {
      throw tokenChanged();
    }

    await recordAudit(tx, {
      clinicId: token.clinicId,
      queueId: token.queueId,
      tokenId,
      actorUserId: access.user.userId,
      action: AUDIT_ACTIONS[action],
      previousState: token.status,
      newState: nextStatus,
    });
    // A recall changes nothing about the token's chats.
    if (action !== "recall") {
      await onTokenChangedForMessaging(tx, {
        tokenId,
        action,
        actorUserId: access.user.userId,
        previousAssignedDoctorId: token.assignedDoctorId,
      });
    }
  });
}

async function buildActionUpdate(
  tx: Tx,
  action: StaffTokenAction,
  token: { queueId: string; assignedDoctorId: string | null },
  access: ClinicAccess,
): Promise<Prisma.QueueTokenUncheckedUpdateManyInput> {
  const now = new Date();
  switch (action) {
    case "recall":
      // A recall restarts the grace period, so calledAt moves to now.
      return { recallCount: { increment: 1 }, calledAt: now };
    case "skip":
      return { status: "SKIPPED", skippedAt: now };
    case "requeue": {
      // A fresh sortKey from the queue counter sends the token to the back;
      // its label (sequenceNumber) never changes.
      const sequence = await allocateSequence(tx, token.queueId);
      if (sequence.status === "CLOSED") {
        throw new AppError("QUEUE_CLOSED", "This queue is closed.");
      }
      return {
        status: "WAITING",
        sortKey: sequence.value,
        calledAt: null,
        skippedAt: null,
      };
    }
    case "cancel":
      return { status: "CANCELLED", cancelledAt: now };
    case "start": {
      // Lock this doctor's membership so two starts by the same doctor
      // can't both see zero active consultations.
      await tx.$queryRaw`
        SELECT id FROM clinic_memberships
        WHERE id = ${access.membershipId}::uuid
        FOR UPDATE`;
      const active = await tx.queueToken.count({
        where: { assignedDoctorId: access.user.userId, status: "IN_SERVICE" },
      });
      assertDoctorFree(active);
      return {
        status: "IN_SERVICE",
        serviceStartedAt: now,
        assignedDoctorId: access.user.userId,
      };
    }
    case "complete":
      if (token.assignedDoctorId !== access.user.userId) {
        throw new AppError(
          "FORBIDDEN",
          "This consultation belongs to another doctor.",
        );
      }
      return { status: "COMPLETED", completedAt: now };
  }
}

// A patient cancels their own waiting token from the status page.
export async function cancelByPatient(publicTokenId: string): Promise<void> {
  await getDb().$transaction(async (tx) => {
    const token = await tx.queueToken.findUnique({
      where: { publicTokenId },
      select: { id: true, status: true, clinicId: true, queueId: true },
    });
    if (!token) {
      throw tokenNotFound();
    }
    // Requeue is a staff action, so the clinic setting doesn't apply here.
    const nextStatus = assertAction("cancel", token.status, {
      allowRequeue: false,
    });

    const { count } = await tx.queueToken.updateMany({
      where: { id: token.id, status: token.status },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    if (count === 0) {
      throw tokenChanged();
    }

    await recordAudit(tx, {
      clinicId: token.clinicId,
      queueId: token.queueId,
      tokenId: token.id,
      action: "token.cancelled",
      previousState: token.status,
      newState: nextStatus,
      metadata: { by: "patient" },
    });
    await onTokenChangedForMessaging(tx, {
      tokenId: token.id,
      action: "cancel",
      actorUserId: null,
      previousAssignedDoctorId: null,
    });
  });
}

// ---- Queue status ----

export type QueueChange = "pause" | "resume" | "close";

const QUEUE_CHANGES: Record<
  QueueChange,
  { from: readonly QueueStatus[]; to: QueueStatus; audit: string }
> = {
  pause: { from: ["OPEN"], to: "PAUSED", audit: "queue.paused" },
  resume: { from: ["PAUSED"], to: "OPEN", audit: "queue.resumed" },
  close: { from: ["OPEN", "PAUSED"], to: "CLOSED", audit: "queue.closed" },
};

// Pausing keeps waiting patients and stops new joins and calls; closing ends
// the queue for the day (assumption until Phase 0 confirms).
export async function changeQueueStatus(
  queueId: string,
  change: QueueChange,
  access: ClinicAccess,
): Promise<void> {
  const { from, to, audit } = QUEUE_CHANGES[change];

  await getDb().$transaction(async (tx) => {
    const queue = await tx.queue.findUnique({
      where: { id: queueId },
      select: { clinicId: true, status: true },
    });
    if (!queue) {
      throw queueNotFound();
    }
    assertSameClinic(queue.clinicId, access);
    if (!from.includes(queue.status)) {
      throw queueChangeError(change, queue.status);
    }

    const { count } = await tx.queue.updateMany({
      where: { id: queueId, status: queue.status },
      data: { status: to },
    });
    if (count === 0) {
      throw new AppError(
        "INVALID_STATE_TRANSITION",
        "This queue was just changed by someone else. Refresh and try again.",
      );
    }

    await recordAudit(tx, {
      clinicId: queue.clinicId,
      queueId,
      actorUserId: access.user.userId,
      action: audit,
      previousState: queue.status,
      newState: to,
    });
  });
}

function queueChangeError(change: QueueChange, status: QueueStatus): AppError {
  if (status === "CLOSED") {
    return new AppError("QUEUE_CLOSED", "This queue is closed.");
  }
  return new AppError(
    "INVALID_STATE_TRANSITION",
    change === "pause"
      ? "The queue is already paused."
      : "The queue is already open.",
  );
}
