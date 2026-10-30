import { getDb } from "@/lib/db";

export type OutboxHealth = {
  // Waiting to be sent, including events backing off after a failure.
  pending: number;
  // Out of retries; someone needs to look at them (docs/RUNBOOK.md).
  failed: number;
  oldestPendingAgeSeconds: number | null;
};

// Counts only: event types, payloads and errors never leave the database here.
export async function getOutboxHealth(
  now: Date = new Date(),
): Promise<OutboxHealth> {
  const db = getDb();
  const pendingWhere = { processedAt: null, failedAt: null };
  const [pending, failed, oldest] = await Promise.all([
    db.outboxEvent.count({ where: pendingWhere }),
    db.outboxEvent.count({
      where: { processedAt: null, failedAt: { not: null } },
    }),
    db.outboxEvent.findFirst({
      where: pendingWhere,
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);
  return {
    pending,
    failed,
    oldestPendingAgeSeconds: oldest
      ? Math.max(
          0,
          Math.round((now.getTime() - oldest.createdAt.getTime()) / 1000),
        )
      : null,
  };
}
