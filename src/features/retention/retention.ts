import { recordAudit } from "@/features/audit/record-audit";
import { getDb } from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;
// Rows cleared per statement, so one run never holds long locks.
const BATCH_SIZE = 500;
// Keeps today's waiting list readable even if a clinic sets 0 days.
const MIN_RETENTION_DAYS = 1;
// Idempotency records only matter for retries on the same queue day, and
// their fingerprint is a hash of the request body, which includes the
// patient's name.
const IDEMPOTENCY_RECORD_DAYS = 2;

export const PATIENT_NAMES_CLEARED = "retention.patient_names_cleared";
export const MESSAGES_DELETED = "retention.messages_deleted";

export type RetentionResult = {
  clinics: number;
  patientNamesCleared: number;
  idempotencyRecordsDeleted: number;
  messagesDeleted: number;
  conversationsDeleted: number;
  broadcastsDeleted: number;
};

type RetentionClinic = { id: string; patientDataRetentionDays: number };

export type MessagingDeletion = {
  messages: number;
  conversations: number;
  broadcasts: number;
};

// Clears patient names and deletes messages, emptied chats and announcements
// older than each clinic's retention period, and deletes stale idempotency
// records. Safe to run any number of times: a second run finds nothing left
// to clear (docs/PRIVACY.md).
export async function runRetention(
  now: Date = new Date(),
): Promise<RetentionResult> {
  const db = getDb();
  const clinics = await db.clinic.findMany({
    select: { id: true, patientDataRetentionDays: true },
  });

  let patientNamesCleared = 0;
  const messaging: MessagingDeletion = {
    messages: 0,
    conversations: 0,
    broadcasts: 0,
  };
  for (const clinic of clinics) {
    patientNamesCleared += await clearClinicPatientNames(clinic, now);
    const deleted = await deleteClinicMessaging(clinic, now);
    messaging.messages += deleted.messages;
    messaging.conversations += deleted.conversations;
    messaging.broadcasts += deleted.broadcasts;
  }

  const { count: idempotencyRecordsDeleted } =
    await db.idempotencyRecord.deleteMany({
      where: {
        createdAt: {
          lt: new Date(now.getTime() - IDEMPOTENCY_RECORD_DAYS * DAY_MS),
        },
      },
    });

  return {
    clinics: clinics.length,
    patientNamesCleared,
    idempotencyRecordsDeleted,
    messagesDeleted: messaging.messages,
    conversationsDeleted: messaging.conversations,
    broadcastsDeleted: messaging.broadcasts,
  };
}

function retentionCutoff(clinic: RetentionClinic, now: Date) {
  const retentionDays = Math.max(
    MIN_RETENTION_DAYS,
    clinic.patientDataRetentionDays,
  );
  return {
    retentionDays,
    cutoff: new Date(now.getTime() - retentionDays * DAY_MS),
  };
}

// Returns how many names were cleared, and records one audit event for the
// clinic when there were any.
export async function clearClinicPatientNames(
  clinic: RetentionClinic,
  now: Date = new Date(),
): Promise<number> {
  const db = getDb();
  const { retentionDays, cutoff } = retentionCutoff(clinic, now);
  const expired = {
    clinicId: clinic.id,
    joinedAt: { lt: cutoff },
    patientName: { not: null },
  };

  let cleared = 0;
  for (;;) {
    const batch = await db.queueToken.findMany({
      where: expired,
      select: { id: true },
      take: BATCH_SIZE,
    });
    if (batch.length === 0) {
      break;
    }
    const { count } = await db.queueToken.updateMany({
      where: { ...expired, id: { in: batch.map((token) => token.id) } },
      data: { patientName: null },
    });
    cleared += count;
    if (count === 0) {
      // Another run cleared these first; nothing left for this one to do.
      break;
    }
  }

  if (cleared > 0) {
    await db.$transaction((tx) =>
      recordAudit(tx, {
        clinicId: clinic.id,
        action: PATIENT_NAMES_CLEARED,
        metadata: {
          count: cleared,
          retentionDays,
          cutoff: cutoff.toISOString(),
        },
      }),
    );
  }
  return cleared;
}

// Deletes the clinic's messages and announcements older than its retention
// period, then chats left with no messages. Message text goes with them;
// recipients go with their announcement. Records one audit event with the
// counts when anything was deleted.
export async function deleteClinicMessaging(
  clinic: RetentionClinic,
  now: Date = new Date(),
): Promise<MessagingDeletion> {
  const db = getDb();
  const { retentionDays, cutoff } = retentionCutoff(clinic, now);

  const messages = await deleteInBatches(
    () =>
      db.message.findMany({
        where: { clinicId: clinic.id, createdAt: { lt: cutoff } },
        select: { id: true },
        take: BATCH_SIZE,
      }),
    (ids) => db.message.deleteMany({ where: { id: { in: ids } } }),
  );
  const broadcasts = await deleteInBatches(
    () =>
      db.broadcast.findMany({
        where: { clinicId: clinic.id, createdAt: { lt: cutoff } },
        select: { id: true },
        take: BATCH_SIZE,
      }),
    (ids) => db.broadcast.deleteMany({ where: { id: { in: ids } } }),
  );
  // Only chats that are both old and empty: a chat with a newer message
  // stays until that message expires too.
  const conversations = await deleteInBatches(
    () =>
      db.conversation.findMany({
        where: {
          clinicId: clinic.id,
          createdAt: { lt: cutoff },
          messages: { none: {} },
        },
        select: { id: true },
        take: BATCH_SIZE,
      }),
    (ids) =>
      db.conversation.deleteMany({
        where: { id: { in: ids }, messages: { none: {} } },
      }),
  );

  const deleted = { messages, conversations, broadcasts };
  if (messages + conversations + broadcasts > 0) {
    await db.$transaction((tx) =>
      recordAudit(tx, {
        clinicId: clinic.id,
        action: MESSAGES_DELETED,
        metadata: {
          ...deleted,
          retentionDays,
          cutoff: cutoff.toISOString(),
        },
      }),
    );
  }
  return deleted;
}

// Finds a batch of ids, deletes them, repeats until none are left, so one
// run never holds long locks.
async function deleteInBatches(
  find: () => Promise<{ id: string }[]>,
  remove: (ids: string[]) => Promise<{ count: number }>,
): Promise<number> {
  let total = 0;
  for (;;) {
    const batch = await find();
    if (batch.length === 0) break;
    const { count } = await remove(batch.map((row) => row.id));
    total += count;
    // Another run deleted these first; nothing left for this one to do.
    if (count === 0) break;
  }
  return total;
}
