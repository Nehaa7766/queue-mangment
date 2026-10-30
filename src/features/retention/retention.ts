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

export type RetentionResult = {
  clinics: number;
  patientNamesCleared: number;
  idempotencyRecordsDeleted: number;
};

type RetentionClinic = { id: string; patientDataRetentionDays: number };

// Clears patient names older than each clinic's retention period and deletes
// stale idempotency records. Safe to run any number of times: a second run
// finds nothing left to clear (docs/PRIVACY.md).
export async function runRetention(
  now: Date = new Date(),
): Promise<RetentionResult> {
  const db = getDb();
  const clinics = await db.clinic.findMany({
    select: { id: true, patientDataRetentionDays: true },
  });

  let patientNamesCleared = 0;
  for (const clinic of clinics) {
    patientNamesCleared += await clearClinicPatientNames(clinic, now);
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
  };
}

// Returns how many names were cleared, and records one audit event for the
// clinic when there were any.
export async function clearClinicPatientNames(
  clinic: RetentionClinic,
  now: Date = new Date(),
): Promise<number> {
  const db = getDb();
  const retentionDays = Math.max(
    MIN_RETENTION_DAYS,
    clinic.patientDataRetentionDays,
  );
  const cutoff = new Date(now.getTime() - retentionDays * DAY_MS);
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
