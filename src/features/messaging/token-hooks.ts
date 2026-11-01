import type { Prisma } from "@/generated/prisma/client";
import { recordAudit } from "@/features/audit/record-audit";
import { resolveRouting, serviceHasDoctor } from "./access";
import { notifyMessaging } from "./notify";
import { doctorRoutingKind, type DoctorRoutingKind } from "./rules";
import { chatNotification } from "./service";

export const DOCTOR_ASSIGNED = "message.doctor_assigned";

// Token changes that move a doctor chat or open/close a chat.
export type MessagingTokenChange =
  "start" | "complete" | "cancel" | "skip" | "requeue";

// Called by the queue service inside its transaction, after the token row
// is updated. Costs one indexed lookup when the token has no chats. When a
// doctor starts a visit that has a doctor chat, records who now answers it
// (docs/MESSAGING.md, "Routing"); either way, open screens get a
// "conversation" hint to refetch routing and open/closed state.
export async function onTokenChangedForMessaging(
  tx: Prisma.TransactionClient,
  change: {
    tokenId: string;
    action: MessagingTokenChange;
    // Null for a patient cancelling their own token.
    actorUserId: string | null;
    // assignedDoctorId before this change.
    previousAssignedDoctorId: string | null;
  },
): Promise<void> {
  const conversations = await tx.conversation.findMany({
    where: { tokenId: change.tokenId },
    select: { id: true, channel: true },
  });
  // Starting a consultation only moves the doctor chat.
  const affected =
    change.action === "start"
      ? conversations.filter((row) => row.channel === "DOCTOR")
      : conversations;
  if (affected.length === 0) return;

  const token = await tx.queueToken.findUniqueOrThrow({
    where: { id: change.tokenId },
    select: {
      id: true,
      clinicId: true,
      queueId: true,
      serviceId: true,
      assignedDoctorId: true,
    },
  });
  const actor = change.actorUserId ? "STAFF" : "PATIENT";

  for (const conversation of affected) {
    let routing: DoctorRoutingKind | null = null;
    let previousRouting: DoctorRoutingKind | undefined;
    if (conversation.channel === "DOCTOR") {
      routing = await resolveRouting(tx, token, "DOCTOR");
      if (change.action === "start") {
        previousRouting = doctorRoutingKind(
          change.previousAssignedDoctorId,
          await serviceHasDoctor(tx, token.clinicId, token.serviceId),
        );
        await recordAudit(tx, {
          clinicId: token.clinicId,
          queueId: token.queueId,
          tokenId: token.id,
          actorUserId: change.actorUserId,
          action: DOCTOR_ASSIGNED,
          metadata: { conversationId: conversation.id },
        });
      }
    }
    await notifyMessaging(
      tx,
      chatNotification(
        "conversation",
        token,
        conversation.id,
        conversation.channel,
        routing,
        actor,
        previousRouting,
      ),
    );
  }
}
