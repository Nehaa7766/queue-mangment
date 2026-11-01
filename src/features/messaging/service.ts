import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import {
  canStaffAccess,
  isConversationClosed,
  type DoctorRoutingKind,
} from "./rules";
import {
  chatTarget,
  conversationSelect,
  lockChatToken,
  resolveRouting,
  type ChatToken,
  type ConversationRow,
  type StaffMember,
} from "./access";
import type { Channel, MessageView } from "./contracts";
import { conversationClosed, conversationNotFound } from "./errors";
import { notifyMessaging } from "./notify";
import { messageSelect, toMessageView, type Side } from "./views";

// Messaging writes (docs/MESSAGING.md, "Sending a message"). Each runs in one
// transaction that locks the token row first, so routing and closing are
// checked against the state the write commits with, and ends with
// pg_notify, which PostgreSQL delivers only on commit.

type Tx = Prisma.TransactionClient;

const TX_OPTIONS = { maxWait: 5_000, timeout: 10_000 };

export type MessageAuthor =
  { kind: "PATIENT" } | { kind: "STAFF"; member: StaffMember };

export type SendInput = {
  tokenId: string;
  channel: Channel;
  author: MessageAuthor;
  clientMessageId: string;
  // Already normalised by messageBodySchema.
  body: string;
};

export type SendResult = {
  message: MessageView;
  // False when a retry with the same clientMessageId returned the stored one.
  created: boolean;
  conversationId: string;
};

export async function sendMessage(input: SendInput): Promise<SendResult> {
  return getDb().$transaction(async (tx) => {
    const token = await lockChatToken(tx, input.tokenId);
    const routing = await resolveRouting(tx, token, input.channel);
    if (
      input.author.kind === "STAFF" &&
      !canStaffAccess(
        input.author.member,
        chatTarget(token, input.channel, routing),
      )
    ) {
      throw conversationNotFound();
    }

    const existing = await tx.conversation.findUnique({
      where: {
        tokenId_channel: { tokenId: token.id, channel: input.channel },
      },
      select: conversationSelect,
    });
    // A retry of a message that was stored before the chat closed still
    // gets its original answer.
    if (existing) {
      const replay = await findReplay(tx, existing, input);
      if (replay) return replay;
    }
    if (isConversationClosed(token)) {
      throw conversationClosed();
    }
    const conversation =
      existing ??
      (await findOrCreateConversation(tx, token, input.channel)).row;

    const createdAt = new Date();
    const [inserted] = await tx.message.createManyAndReturn({
      data: [
        {
          conversationId: conversation.id,
          clinicId: token.clinicId,
          sender: input.author.kind,
          senderUserId:
            input.author.kind === "STAFF" ? input.author.member.userId : null,
          body: input.body,
          clientMessageId: input.clientMessageId,
          createdAt,
        },
      ],
      // Two retries racing: the second one finds the first one's row.
      skipDuplicates: true,
      select: { id: true },
    });
    if (!inserted) {
      const replay = await findReplay(tx, conversation, input);
      if (replay) return replay;
      throw new AppError("INTERNAL_ERROR", "The message could not be stored.");
    }

    // Writing also counts as reading for the sender's own side.
    await recordNewMessage(tx, conversation.id, input.author.kind, createdAt, {
      markSenderRead: true,
    });
    await notifyMessaging(
      tx,
      chatNotification(
        "message",
        token,
        conversation.id,
        input.channel,
        routing,
        input.author.kind,
      ),
    );

    const stored = await loadConversationMessage(
      tx,
      conversation.id,
      inserted.id,
      token,
    );
    return {
      message: toMessageView(
        stored.row,
        input.channel,
        input.author.kind,
        stored.readTimes,
      ),
      created: true,
      conversationId: conversation.id,
    };
  }, TX_OPTIONS);
}

// The message already stored under this clientMessageId, or null. Routes
// ask this before counting the rate limit, so a retry after a lost response
// gets its message back instead of a 429. sendMessage checks again inside
// its transaction for retries that race.
export async function findStoredMessage(
  input: SendInput,
): Promise<SendResult | null> {
  const db = getDb();
  const conversation = await db.conversation.findUnique({
    where: {
      tokenId_channel: { tokenId: input.tokenId, channel: input.channel },
    },
    select: conversationSelect,
  });
  return conversation ? findReplay(db, conversation, input) : null;
}

// The stored message for a repeated clientMessageId, or null if there is
// none. The same id with different text, or from someone else, is a conflict.
async function findReplay(
  tx: Tx,
  conversation: ConversationRow,
  input: SendInput,
): Promise<SendResult | null> {
  const row = await tx.message.findUnique({
    where: {
      conversationId_clientMessageId: {
        conversationId: conversation.id,
        clientMessageId: input.clientMessageId,
      },
    },
    select: messageSelect(conversation.clinicId),
  });
  if (!row) return null;
  const sameAuthor =
    row.sender === input.author.kind &&
    (input.author.kind === "PATIENT" ||
      row.senderUserId === input.author.member.userId);
  if (!sameAuthor || row.body !== input.body) {
    throw new AppError(
      "IDEMPOTENCY_CONFLICT",
      "This message was already sent with different text.",
    );
  }
  const current = await tx.conversation.findUniqueOrThrow({
    where: { id: conversation.id },
    select: { staffReadAt: true, patientReadAt: true },
  });
  return {
    message: toMessageView(
      row,
      conversation.channel,
      input.author.kind,
      current,
    ),
    created: false,
    conversationId: conversation.id,
  };
}

async function loadConversationMessage(
  tx: Tx,
  conversationId: string,
  messageId: string,
  token: ChatToken,
) {
  // One after the other: a transaction runs on a single connection.
  const row = await tx.message.findUniqueOrThrow({
    where: { id: messageId },
    select: messageSelect(token.clinicId),
  });
  const readTimes = await tx.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    select: { staffReadAt: true, patientReadAt: true },
  });
  return { row, readTimes };
}

// Safe when two writers create the same chat at once: the unique
// (token_id, channel) constraint keeps one row and both writers use it.
export async function findOrCreateConversation(
  tx: Tx,
  token: Pick<ChatToken, "id" | "clinicId">,
  channel: Channel,
): Promise<{ row: ConversationRow; created: boolean }> {
  const { count } = await tx.conversation.createMany({
    data: [{ clinicId: token.clinicId, tokenId: token.id, channel }],
    skipDuplicates: true,
  });
  const row = await tx.conversation.findUniqueOrThrow({
    where: { tokenId_channel: { tokenId: token.id, channel } },
    select: conversationSelect,
  });
  return { row, created: count > 0 };
}

// Counters for a new message. GREATEST keeps last_message_at moving forward
// when two sends commit out of order. Columns are UTC timestamps without a
// time zone, like the ones Prisma writes.
export async function recordNewMessage(
  tx: Tx,
  conversationId: string,
  sender: Side,
  createdAt: Date,
  options: { markSenderRead: boolean },
): Promise<void> {
  const at = createdAt.toISOString();
  if (sender === "PATIENT") {
    await tx.$executeRaw`
      UPDATE conversations SET
        last_message_at = GREATEST(last_message_at, (${at}::timestamptz AT TIME ZONE 'UTC')),
        unread_by_staff = unread_by_staff + 1,
        patient_read_at = CASE WHEN ${options.markSenderRead}
          THEN GREATEST(patient_read_at, (${at}::timestamptz AT TIME ZONE 'UTC'))
          ELSE patient_read_at END,
        unread_by_patient = CASE WHEN ${options.markSenderRead} THEN 0 ELSE unread_by_patient END,
        updated_at = (${at}::timestamptz AT TIME ZONE 'UTC')
      WHERE id = ${conversationId}::uuid`;
  } else {
    await tx.$executeRaw`
      UPDATE conversations SET
        last_message_at = GREATEST(last_message_at, (${at}::timestamptz AT TIME ZONE 'UTC')),
        unread_by_patient = unread_by_patient + 1,
        staff_read_at = CASE WHEN ${options.markSenderRead}
          THEN GREATEST(staff_read_at, (${at}::timestamptz AT TIME ZONE 'UTC'))
          ELSE staff_read_at END,
        unread_by_staff = CASE WHEN ${options.markSenderRead} THEN 0 ELSE unread_by_staff END,
        updated_at = (${at}::timestamptz AT TIME ZONE 'UTC')
      WHERE id = ${conversationId}::uuid`;
  }
}

export function chatNotification(
  type: "message" | "read" | "conversation",
  token: Pick<ChatToken, "id" | "clinicId" | "serviceId" | "assignedDoctorId">,
  conversationId: string,
  channel: Channel,
  routing: DoctorRoutingKind | null,
  actor: "PATIENT" | "STAFF" | "SYSTEM",
  previousRouting?: DoctorRoutingKind | null,
) {
  return {
    type,
    clinicId: token.clinicId,
    conversationId,
    tokenId: token.id,
    channel,
    serviceId: token.serviceId,
    assignedDoctorId: token.assignedDoctorId,
    routing,
    ...(previousRouting !== undefined ? { previousRouting } : {}),
    actor,
  };
}

// ---- Reading ----

// Sets the reader's side read time to now and clears its unread count, then
// tells the other side so "Seen" updates. Quiet when there is nothing new.
export async function markConversationRead(
  conversationId: string,
  side: Side,
  now: Date = new Date(),
): Promise<void> {
  await getDb().$transaction(async (tx) => {
    const at = now.toISOString();
    const updated =
      side === "PATIENT"
        ? await tx.$queryRaw<{ id: string }[]>`
            UPDATE conversations SET
              patient_read_at = GREATEST(patient_read_at, (${at}::timestamptz AT TIME ZONE 'UTC')),
              unread_by_patient = 0,
              updated_at = (${at}::timestamptz AT TIME ZONE 'UTC')
            WHERE id = ${conversationId}::uuid
              AND (unread_by_patient > 0
                OR (last_message_at IS NOT NULL
                  AND (patient_read_at IS NULL OR patient_read_at < last_message_at)))
            RETURNING id::text AS id`
        : await tx.$queryRaw<{ id: string }[]>`
            UPDATE conversations SET
              staff_read_at = GREATEST(staff_read_at, (${at}::timestamptz AT TIME ZONE 'UTC')),
              unread_by_staff = 0,
              updated_at = (${at}::timestamptz AT TIME ZONE 'UTC')
            WHERE id = ${conversationId}::uuid
              AND (unread_by_staff > 0
                OR (last_message_at IS NOT NULL
                  AND (staff_read_at IS NULL OR staff_read_at < last_message_at)))
            RETURNING id::text AS id`;
    if (updated.length === 0) return;

    const conversation = await tx.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      select: {
        channel: true,
        token: {
          select: {
            id: true,
            clinicId: true,
            serviceId: true,
            assignedDoctorId: true,
          },
        },
      },
    });
    const routing = await resolveRouting(
      tx,
      conversation.token,
      conversation.channel,
    );
    await notifyMessaging(
      tx,
      chatNotification(
        "read",
        conversation.token,
        conversationId,
        conversation.channel,
        routing,
        side,
      ),
    );
  });
}

// ---- Starting a chat (staff) ----

// Finds or creates the chat for a token so staff can open it before anyone
// has written. A closed chat that never existed is not created.
export async function startConversation(
  tokenId: string,
  channel: Channel,
  member: StaffMember,
): Promise<{ conversationId: string; created: boolean }> {
  return getDb().$transaction(async (tx) => {
    const token = await lockChatToken(tx, tokenId);
    const routing = await resolveRouting(tx, token, channel);
    if (!canStaffAccess(member, chatTarget(token, channel, routing))) {
      throw conversationNotFound();
    }
    const existing = await tx.conversation.findUnique({
      where: { tokenId_channel: { tokenId, channel } },
      select: { id: true },
    });
    if (existing) return { conversationId: existing.id, created: false };
    if (isConversationClosed(token)) throw conversationClosed();
    const { row, created } = await findOrCreateConversation(tx, token, channel);
    return { conversationId: row.id, created };
  }, TX_OPTIONS);
}
