import type { Prisma } from "@/generated/prisma/client";
import { MESSAGING_NOTIFY_CHANNEL, type MessagingNotification } from "./rules";

// Queues a live hint inside the caller's transaction. PostgreSQL delivers it
// to every listening web process only if the transaction commits, so a
// rolled-back send never produces a hint. Ids and routing only: never pass
// message text (docs/MESSAGING.md, "Limits and security").
export async function notifyMessaging(
  tx: Prisma.TransactionClient,
  notification: MessagingNotification,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_notify(${MESSAGING_NOTIFY_CHANNEL}, ${JSON.stringify(notification)})`;
}
