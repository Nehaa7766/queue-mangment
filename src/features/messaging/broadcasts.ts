import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { recordAudit } from "@/features/audit/record-audit";
import { clinicToday, toDbDate } from "@/features/queue/clinic-time";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { lockChatToken, type ChatToken, type StaffMember } from "./access";
import type {
  BroadcastAudience,
  BroadcastDetail,
  BroadcastRecipientStatus,
  BroadcastSkipReason,
  BroadcastSummary,
} from "./contracts";
import { announcementNotFound } from "./errors";
import { notifyMessaging } from "./notify";
import { isConversationClosed } from "./rules";
import {
  chatNotification,
  findOrCreateConversation,
  recordNewMessage,
} from "./service";
import { announcementClientMessageId } from "./views";

// Announcements (docs/MESSAGING.md, "Announcements"): one text sent as a
// separate private message into each recipient's reception chat.
// Recipients are fixed when the announcement is created; their rows are
// the work queue, processed right after the create request (after()) and
// again on every outbox worker run, so a crash only delays delivery.

type Db = Prisma.TransactionClient;

export const BROADCAST_SENT = "message.broadcast_sent";
// Newest announcements on the list page.
const LIST_LIMIT = 50;
const BATCH_SIZE = 20;
// Per run, so one call stays well inside the worker's 10-second rhythm.
const DEFAULT_MAX_BATCHES = 10;
export const MAX_RECIPIENT_ATTEMPTS = 5;
const TX_OPTIONS = { maxWait: 5_000, timeout: 10_000 };

const uuidSchema = z.uuid();

// Patients who get it: waiting or called on today's queues (clinic
// timezone), in the chosen services or all of them.
function eligibleTokenWhere(
  member: Pick<StaffMember, "clinicId" | "clinicTimezone">,
  serviceIds: readonly string[],
  now: Date,
): Prisma.QueueTokenWhereInput {
  return {
    clinicId: member.clinicId,
    status: { in: ["WAITING", "CALLED"] },
    queue: { queueDate: toDbDate(clinicToday(member.clinicTimezone, now)) },
    ...(serviceIds.length > 0 ? { serviceId: { in: [...serviceIds] } } : {}),
  };
}

// ?serviceIds=a,b (empty or missing means every service).
export function parseServiceIdsParam(value: string | null): string[] {
  const ids = (value ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (ids.length > 50 || !ids.every((id) => uuidSchema.safeParse(id).success)) {
    throw new AppError("VALIDATION_ERROR", "Choose services from this clinic.");
  }
  return [...new Set(ids)];
}

async function assertClinicServices(
  db: Db,
  clinicId: string,
  serviceIds: readonly string[],
): Promise<void> {
  if (serviceIds.length === 0) return;
  const count = await db.service.count({
    where: { clinicId, id: { in: [...serviceIds] } },
  });
  if (count !== serviceIds.length) {
    throw new AppError("VALIDATION_ERROR", "Choose services from this clinic.");
  }
}

// ---- Audience ----

export async function getBroadcastAudience(
  member: StaffMember,
  serviceIds: readonly string[],
  now: Date = new Date(),
): Promise<BroadcastAudience> {
  const db = getDb();
  await assertClinicServices(db, member.clinicId, serviceIds);
  const grouped = await db.queueToken.groupBy({
    by: ["serviceId"],
    where: eligibleTokenWhere(member, [], now),
    _count: { _all: true },
  });
  const counts = new Map(
    grouped.map((row) => [row.serviceId, row._count._all]),
  );
  // Active services, plus any turned off today that still has patients.
  const services = await db.service.findMany({
    where: {
      clinicId: member.clinicId,
      OR: [{ isActive: true }, { id: { in: [...counts.keys()] } }],
    },
    orderBy: { tokenPrefix: "asc" },
    select: { id: true, name: true, tokenPrefix: true },
  });
  const chosen = serviceIds.length > 0 ? new Set(serviceIds) : null;
  let eligible = 0;
  for (const [serviceId, count] of counts) {
    if (!chosen || chosen.has(serviceId)) eligible += count;
  }
  return {
    eligible,
    services: services.map((service) => ({
      serviceId: service.id,
      name: service.name,
      tokenPrefix: service.tokenPrefix,
      eligible: counts.get(service.id) ?? 0,
    })),
  };
}

// ---- Create ----

export type CreateBroadcastInput = {
  idempotencyKey: string;
  // Already normalised by messageBodySchema.
  body: string;
  serviceIds: string[];
};

// Creates the announcement and one PENDING recipient per eligible patient,
// in one transaction with its audit event (which never holds the text).
// A repeated idempotency key returns the existing announcement.
export async function createBroadcast(
  member: StaffMember,
  input: CreateBroadcastInput,
  now: Date = new Date(),
): Promise<{ summary: BroadcastSummary; created: boolean }> {
  const db = getDb();
  const serviceIds = [...new Set(input.serviceIds)].sort();
  const key = {
    clinicId_idempotencyKey: {
      clinicId: member.clinicId,
      idempotencyKey: input.idempotencyKey,
    },
  };

  let result: { id: string; created: boolean };
  try {
    result = await db.$transaction(async (tx) => {
      const existing = await tx.broadcast.findUnique({
        where: key,
        select: { id: true, body: true, serviceIds: true },
      });
      if (existing) {
        assertSameRequest(existing, input.body, serviceIds);
        return { id: existing.id, created: false };
      }

      await assertClinicServices(tx, member.clinicId, serviceIds);
      const tokens = await tx.queueToken.findMany({
        where: eligibleTokenWhere(member, serviceIds, now),
        orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
        select: { id: true },
      });
      if (tokens.length === 0) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Nobody is waiting or called today in the chosen services.",
        );
      }

      const broadcast = await tx.broadcast.create({
        data: {
          clinicId: member.clinicId,
          createdByUserId: member.userId,
          body: input.body,
          serviceIds,
          totalRecipients: tokens.length,
          idempotencyKey: input.idempotencyKey,
        },
        select: { id: true },
      });
      await tx.broadcastRecipient.createMany({
        data: tokens.map((token) => ({
          broadcastId: broadcast.id,
          tokenId: token.id,
        })),
      });
      await recordAudit(tx, {
        clinicId: member.clinicId,
        actorUserId: member.userId,
        action: BROADCAST_SENT,
        metadata: {
          broadcastId: broadcast.id,
          recipients: tokens.length,
          services: serviceIds.length,
        },
      });
      await notifyMessaging(tx, {
        type: "broadcast",
        clinicId: member.clinicId,
        broadcastId: broadcast.id,
      });
      return { id: broadcast.id, created: true };
    }, TX_OPTIONS);
  } catch (error) {
    // Two requests with one key raced; this one lost on the unique
    // (clinic_id, idempotency_key) constraint. Answer with the winner's.
    if (!isUniqueViolation(error)) throw error;
    const existing = await db.broadcast.findUnique({
      where: key,
      select: { id: true, body: true, serviceIds: true },
    });
    if (!existing) throw error;
    assertSameRequest(existing, input.body, serviceIds);
    result = { id: existing.id, created: false };
  }

  const [summary] = await loadSummaries(db, member.clinicId, { id: result.id });
  return { summary, created: result.created };
}

// The announcement already stored under this idempotency key, or null.
// The create route asks this before counting the rate limit, so a retry
// after a lost response always gets its announcement back, never a 429.
export async function findBroadcastReplay(
  member: StaffMember,
  input: CreateBroadcastInput,
): Promise<BroadcastSummary | null> {
  const db = getDb();
  const existing = await db.broadcast.findUnique({
    where: {
      clinicId_idempotencyKey: {
        clinicId: member.clinicId,
        idempotencyKey: input.idempotencyKey,
      },
    },
    select: { id: true, body: true, serviceIds: true },
  });
  if (!existing) return null;
  assertSameRequest(
    existing,
    input.body,
    [...new Set(input.serviceIds)].sort(),
  );
  const [summary] = await loadSummaries(db, member.clinicId, {
    id: existing.id,
  });
  return summary;
}

function assertSameRequest(
  existing: { body: string; serviceIds: string[] },
  body: string,
  serviceIds: readonly string[],
): void {
  const same =
    existing.body === body &&
    [...existing.serviceIds].sort().join(",") === serviceIds.join(",");
  if (!same) {
    throw new AppError(
      "IDEMPOTENCY_CONFLICT",
      "This announcement was already sent with different details.",
    );
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

// ---- Processing ----

export type BroadcastRunResult = {
  sent: number;
  skipped: number;
  retrying: number;
  failed: number;
  // Announcements that became DONE in this run.
  completed: number;
};

type RecipientOutcome = "sent" | "skipped" | "retrying" | "failed" | "busy";

// Delivers PENDING recipients in batches of 20. Each recipient is claimed
// with FOR UPDATE SKIP LOCKED in its own transaction, so concurrent runs
// (after() and the worker) never deliver to one patient twice, and one bad
// recipient never holds up the rest. A recipient that errors is tried again
// on a later run (at most once per run) and becomes FAILED after 5 attempts.
export async function processPendingBroadcasts(
  options: { broadcastId?: string; maxBatches?: number; now?: Date } = {},
): Promise<BroadcastRunResult> {
  const db = getDb();
  const maxBatches = options.maxBatches ?? DEFAULT_MAX_BATCHES;
  const result: BroadcastRunResult = {
    sent: 0,
    skipped: 0,
    retrying: 0,
    failed: 0,
    completed: 0,
  };
  const tried: string[] = [];

  for (let batch = 0; batch < maxBatches; batch += 1) {
    const onlyBroadcast = options.broadcastId
      ? Prisma.sql`AND broadcast_id = ${options.broadcastId}::uuid`
      : Prisma.empty;
    const candidates = await db.$queryRaw<
      { id: string; broadcastId: string }[]
    >`
      SELECT id::text AS id, broadcast_id::text AS "broadcastId"
      FROM broadcast_recipients
      WHERE status = 'PENDING'
        ${onlyBroadcast}
        AND NOT (id = ANY(${tried}::uuid[]))
      ORDER BY broadcast_id, id
      LIMIT ${BATCH_SIZE}`;
    if (candidates.length === 0) break;

    const progressed = new Map<string, string>();
    for (const candidate of candidates) {
      tried.push(candidate.id);
      const outcome = await processRecipient(candidate.id, options.now);
      if (outcome === "busy") continue;
      result[outcome] += 1;
      progressed.set(candidate.broadcastId, candidate.broadcastId);
    }
    // One progress hint per announcement per batch, for the staff screens.
    if (progressed.size > 0) {
      const clinics = await db.broadcast.findMany({
        where: { id: { in: [...progressed.keys()] } },
        select: { id: true, clinicId: true },
      });
      for (const row of clinics) {
        await notifyMessaging(db, {
          type: "broadcast",
          clinicId: row.clinicId,
          broadcastId: row.id,
        });
      }
    }
  }

  result.completed = await completeFinishedBroadcasts(db, options.now);
  return result;
}

async function processRecipient(
  recipientId: string,
  now: Date = new Date(),
): Promise<RecipientOutcome> {
  const db = getDb();
  let body: string | null = null;
  try {
    return await db.$transaction(async (tx) => {
      const [claimed] = await tx.$queryRaw<
        { broadcastId: string; tokenId: string }[]
      >`
        SELECT broadcast_id::text AS "broadcastId", token_id::text AS "tokenId"
        FROM broadcast_recipients
        WHERE id = ${recipientId}::uuid AND status = 'PENDING'
        FOR UPDATE SKIP LOCKED`;
      // Another run holds it, or it was finished meanwhile.
      if (!claimed) return "busy";

      const broadcast = await tx.broadcast.findUniqueOrThrow({
        where: { id: claimed.broadcastId },
        select: { id: true, clinicId: true, body: true, createdByUserId: true },
      });
      body = broadcast.body;
      const token = await lockChatToken(tx, claimed.tokenId);
      const skipReason = recipientSkipReason(token, now);
      if (skipReason) {
        await tx.broadcastRecipient.update({
          where: { id: recipientId },
          data: { status: "SKIPPED", skipReason, processedAt: now },
        });
        return "skipped";
      }

      const { row: conversation } = await findOrCreateConversation(
        tx,
        token,
        "RECEPTION",
      );
      // One message per announcement per chat: a rerun finds it instead of
      // adding a copy.
      const clientMessageId = announcementClientMessageId(broadcast.id);
      const createdAt = new Date();
      const [inserted] = await tx.message.createManyAndReturn({
        data: [
          {
            conversationId: conversation.id,
            clinicId: broadcast.clinicId,
            sender: "STAFF",
            senderUserId: broadcast.createdByUserId,
            body: broadcast.body,
            clientMessageId,
            broadcastId: broadcast.id,
            createdAt,
          },
        ],
        skipDuplicates: true,
        select: { id: true },
      });
      let messageId = inserted?.id;
      if (inserted) {
        // Nobody on the staff side read anything, so their read time stays.
        await recordNewMessage(tx, conversation.id, "STAFF", createdAt, {
          markSenderRead: false,
        });
        await notifyMessaging(
          tx,
          chatNotification(
            "message",
            token,
            conversation.id,
            "RECEPTION",
            null,
            "STAFF",
          ),
        );
      } else {
        const stored = await tx.message.findUniqueOrThrow({
          where: {
            conversationId_clientMessageId: {
              conversationId: conversation.id,
              clientMessageId,
            },
          },
          select: { id: true },
        });
        messageId = stored.id;
      }

      await tx.broadcastRecipient.update({
        where: { id: recipientId },
        data: {
          status: "SENT",
          conversationId: conversation.id,
          messageId,
          processedAt: now,
          lastError: null,
        },
      });
      return "sent";
    }, TX_OPTIONS);
  } catch (error) {
    const lastError = describeError(error, body);
    const at = now.toISOString();
    const [row] = await db.$queryRaw<{ status: string }[]>`
      UPDATE broadcast_recipients SET
        attempts = attempts + 1,
        last_error = ${lastError},
        status = CASE WHEN attempts + 1 >= ${MAX_RECIPIENT_ATTEMPTS}
          THEN 'FAILED'::"BroadcastRecipientStatus" ELSE status END,
        processed_at = CASE WHEN attempts + 1 >= ${MAX_RECIPIENT_ATTEMPTS}
          THEN (${at}::timestamptz AT TIME ZONE 'UTC') ELSE processed_at END
      WHERE id = ${recipientId}::uuid AND status = 'PENDING'
      RETURNING status::text AS status`;
    return row?.status === "FAILED" ? "failed" : "retrying";
  }
}

// Why a patient is left out when their turn comes, or null to send.
export function recipientSkipReason(
  token: Pick<
    ChatToken,
    "status" | "joinedAt" | "completedAt" | "cancelledAt" | "skippedAt"
  >,
  now: Date,
): BroadcastSkipReason | null {
  if (token.status === "IN_SERVICE") return "IN_CONSULTATION";
  if (token.status !== "WAITING" && token.status !== "CALLED") {
    return "VISIT_ENDED";
  }
  if (isConversationClosed(token, now)) return "CHAT_CLOSED";
  return null;
}

// Stored for staff to look at: short, and never the announcement text.
function describeError(error: unknown, body: string | null): string {
  const raw =
    error instanceof Prisma.PrismaClientKnownRequestError
      ? `Database error ${error.code}`
      : error instanceof Error
        ? `${error.name}: ${error.message}`
        : "Unknown error";
  const safe = body ? raw.split(body).join("[text]") : raw;
  return safe.slice(0, 300);
}

// Announcements with nothing PENDING become DONE.
async function completeFinishedBroadcasts(
  db: Db,
  now: Date = new Date(),
): Promise<number> {
  const at = now.toISOString();
  const done = await db.$queryRaw<{ id: string; clinicId: string }[]>`
    UPDATE broadcasts AS b SET
      status = 'DONE',
      completed_at = (${at}::timestamptz AT TIME ZONE 'UTC')
    WHERE b.status = 'SENDING'
      AND NOT EXISTS (
        SELECT 1 FROM broadcast_recipients r
        WHERE r.broadcast_id = b.id AND r.status = 'PENDING'
      )
    RETURNING b.id::text AS id, b.clinic_id::text AS "clinicId"`;
  for (const row of done) {
    await notifyMessaging(db, {
      type: "broadcast",
      clinicId: row.clinicId,
      broadcastId: row.id,
    });
  }
  return done.length;
}

// ---- Reads ----

const summarySelect = {
  id: true,
  body: true,
  createdAt: true,
  serviceIds: true,
  status: true,
  totalRecipients: true,
  createdBy: { select: { name: true } },
} satisfies Prisma.BroadcastSelect;

type CountRow = {
  broadcastId: string;
  status: string;
  count: number;
  seen: number;
};

async function loadSummaries(
  db: Db,
  clinicId: string,
  where: Prisma.BroadcastWhereInput,
  take?: number,
): Promise<BroadcastSummary[]> {
  const rows = await db.broadcast.findMany({
    where: { ...where, clinicId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: summarySelect,
  });
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  // "Seen": sent, and the patient's read time is at or after the message.
  const countRows = await db.$queryRaw<CountRow[]>`
    SELECT r.broadcast_id::text AS "broadcastId",
      r.status::text AS status,
      count(*)::int AS count,
      (count(*) FILTER (
        WHERE r.status = 'SENT' AND c.patient_read_at >= m.created_at
      ))::int AS seen
    FROM broadcast_recipients r
    LEFT JOIN conversations c ON c.id = r.conversation_id
    LEFT JOIN messages m ON m.id = r.message_id
    WHERE r.broadcast_id = ANY(${ids}::uuid[])
    GROUP BY r.broadcast_id, r.status`;
  const services = await db.service.findMany({
    where: {
      clinicId,
      id: { in: [...new Set(rows.flatMap((row) => row.serviceIds))] },
    },
    select: { id: true, name: true },
  });
  const serviceNames = new Map(services.map((s) => [s.id, s.name]));

  return rows.map((row) => {
    const counts = {
      total: row.totalRecipients,
      pending: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      seen: 0,
    };
    for (const count of countRows) {
      if (count.broadcastId !== row.id) continue;
      const status = count.status as BroadcastRecipientStatus;
      if (status === "PENDING") counts.pending = count.count;
      if (status === "SENT") counts.sent = count.count;
      if (status === "SKIPPED") counts.skipped = count.count;
      if (status === "FAILED") counts.failed = count.count;
      counts.seen += count.seen;
    }
    return {
      id: row.id,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      createdByName: row.createdBy?.name ?? null,
      serviceNames: row.serviceIds.flatMap((id) => serviceNames.get(id) ?? []),
      status: row.status,
      counts,
    };
  });
}

// The 50 newest, newest first.
export function listBroadcasts(
  member: StaffMember,
): Promise<BroadcastSummary[]> {
  return loadSummaries(getDb(), member.clinicId, {}, LIST_LIMIT);
}

export async function getBroadcastDetail(
  member: StaffMember,
  broadcastId: string,
): Promise<BroadcastDetail> {
  if (!uuidSchema.safeParse(broadcastId).success) throw announcementNotFound();
  const db = getDb();
  // Scoped to the member's clinic: another clinic's id is simply not found.
  const [summary] = await loadSummaries(db, member.clinicId, {
    id: broadcastId,
  });
  if (!summary) throw announcementNotFound();

  const recipients = await db.broadcastRecipient.findMany({
    where: { broadcastId },
    orderBy: [{ token: { joinedAt: "asc" } }, { id: "asc" }],
    select: {
      tokenId: true,
      status: true,
      skipReason: true,
      messageId: true,
      token: {
        select: {
          tokenLabel: true,
          patientName: true,
          service: { select: { name: true } },
        },
      },
      conversation: { select: { patientReadAt: true } },
    },
  });
  const messageIds = recipients.flatMap((r) =>
    r.messageId ? [r.messageId] : [],
  );
  const messages = await db.message.findMany({
    where: { id: { in: messageIds } },
    select: { id: true, createdAt: true },
  });
  const sentAt = new Map(messages.map((m) => [m.id, m.createdAt]));

  return {
    ...summary,
    recipients: recipients.map((recipient) => {
      const messageAt = recipient.messageId
        ? sentAt.get(recipient.messageId)
        : undefined;
      const readAt = recipient.conversation?.patientReadAt;
      return {
        tokenId: recipient.tokenId,
        tokenLabel: recipient.token.tokenLabel,
        patientName: recipient.token.patientName,
        serviceName: recipient.token.service.name,
        status: recipient.status,
        skipReason:
          (recipient.skipReason as BroadcastSkipReason | null) ?? null,
        seen:
          recipient.status === "SENT" &&
          !!messageAt &&
          !!readAt &&
          readAt.getTime() >= messageAt.getTime(),
      };
    }),
  };
}
