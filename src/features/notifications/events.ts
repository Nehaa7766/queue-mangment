import type { Prisma } from "@/generated/prisma/client";
import type { MembershipRole } from "@/generated/prisma/enums";

// Shared contract between the code that records an event (Phase 7 staff
// invitations, Phase 8 password resets) and the outbox worker that sends the
// email (Phase 8). Add new event types here; never change an existing payload.
//
// A payload may carry a one-time link until the email is sent. The worker
// removes the link from the stored payload once delivery succeeds.

export type OutboxPayloads = {
  "staff.invited": {
    invitationId: string;
    email: string;
    name: string;
    clinicName: string;
    role: MembershipRole;
    acceptUrl: string;
    expiresAt: string;
  };
  "auth.password-reset-requested": {
    userId: string;
    email: string;
    name: string;
    resetUrl: string;
    expiresAt: string;
  };
};

export type OutboxEventType = keyof OutboxPayloads;

// Write the event in the same transaction as the change that caused it, so
// the email is sent only if that change commits (docs/PLAN.md §10).
export async function enqueueOutboxEvent<T extends OutboxEventType>(
  tx: Prisma.TransactionClient,
  eventType: T,
  aggregateId: string,
  payload: OutboxPayloads[T],
): Promise<void> {
  await tx.outboxEvent.create({
    data: { eventType, aggregateId, payload },
  });
}
