import type { Prisma } from "@/generated/prisma/client";

export type PlatformAuditTarget =
  "clinic" | "user" | "support_ticket" | "platform_setting";

export type PlatformAuditInput = {
  actorUserId: string | null;
  // Dotted verb, e.g. "clinic.suspended" or "user.deactivated".
  action: string;
  targetType: PlatformAuditTarget;
  targetId?: string | null;
  // Keep small; never include passwords or session data.
  metadata?: Prisma.InputJsonValue;
};

// Takes the transaction client so the audit row commits or rolls back with
// the change it describes.
export async function recordPlatformAudit(
  tx: Prisma.TransactionClient,
  event: PlatformAuditInput,
): Promise<void> {
  await tx.platformAuditEvent.create({ data: event });
}
