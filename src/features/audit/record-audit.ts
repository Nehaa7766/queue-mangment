import type { Prisma } from "@/generated/prisma/client";

export type AuditEventInput = {
  clinicId: string;
  // Dotted verb, e.g. "token.called" or "queue.paused".
  action: string;
  // Null for patient self-service or system actions.
  actorUserId?: string | null;
  queueId?: string | null;
  tokenId?: string | null;
  previousState?: string | null;
  newState?: string | null;
  // Keep small; never include passwords, session data or extra patient details.
  metadata?: Prisma.InputJsonValue;
};

// Takes the transaction client so the audit row commits or rolls back
// together with the action it describes.
export async function recordAudit(
  tx: Prisma.TransactionClient,
  event: AuditEventInput,
): Promise<void> {
  await tx.auditEvent.create({ data: event });
}
