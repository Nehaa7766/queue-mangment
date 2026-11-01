import type { Prisma } from "@/generated/prisma/client";
import type {
  Channel,
  ConversationState,
  DoctorRouting,
  MessageView,
} from "./contracts";

// Maps rows to the shapes in contracts.ts.

export type Side = "PATIENT" | "STAFF";

const ANNOUNCEMENT_PREFIX = "announcement:";

export function announcementClientMessageId(broadcastId: string): string {
  return `${ANNOUNCEMENT_PREFIX}${broadcastId}`;
}

// The sender's role in the chat's clinic decides what a patient sees.
export function messageSelect(clinicId: string) {
  return {
    id: true,
    clientMessageId: true,
    sender: true,
    senderUserId: true,
    body: true,
    createdAt: true,
    broadcastId: true,
    senderUser: {
      select: {
        name: true,
        memberships: { where: { clinicId }, select: { role: true } },
      },
    },
  } satisfies Prisma.MessageSelect;
}

export type MessageRow = Prisma.MessageGetPayload<{
  select: ReturnType<typeof messageSelect>;
}>;

export type ReadTimes = {
  staffReadAt: Date | null;
  patientReadAt: Date | null;
};

// Patients see "Reception" for the desk (including reception answering a
// doctor chat) and the doctor's own name for doctors. Staff see names.
export function senderNameFor(
  row: Pick<MessageRow, "sender" | "senderUser">,
  channel: Channel,
  viewer: Side,
): string | null {
  if (row.sender === "PATIENT") return null;
  if (viewer === "STAFF") return row.senderUser?.name ?? "Former staff member";
  if (channel === "RECEPTION") return "Reception";
  const role = row.senderUser?.memberships[0]?.role;
  if (role === "DOCTOR") return row.senderUser!.name;
  return row.senderUser ? "Reception" : "Doctor";
}

export function toMessageView(
  row: MessageRow,
  channel: Channel,
  viewer: Side,
  readTimes: ReadTimes,
): MessageView {
  // Seen once the other side's read time is at or after the message.
  const otherReadAt =
    row.sender === "PATIENT" ? readTimes.staffReadAt : readTimes.patientReadAt;
  return {
    id: row.id,
    clientMessageId: row.clientMessageId,
    sender: row.sender,
    senderName: senderNameFor(row, channel, viewer),
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    seen:
      otherReadAt !== null && otherReadAt.getTime() >= row.createdAt.getTime(),
    isAnnouncement:
      row.broadcastId !== null ||
      row.clientMessageId.startsWith(ANNOUNCEMENT_PREFIX),
  };
}

export function toConversationState(input: {
  conversation: {
    id: string;
    unreadByStaff: number;
    unreadByPatient: number;
  } | null;
  channel: Channel;
  closed: boolean;
  viewer: Side;
  routing: DoctorRouting | null;
}): ConversationState {
  const { conversation, viewer } = input;
  return {
    conversationId: conversation?.id ?? null,
    channel: input.channel,
    closed: input.closed,
    unread: conversation
      ? viewer === "STAFF"
        ? conversation.unreadByStaff
        : conversation.unreadByPatient
      : 0,
    routing: input.channel === "DOCTOR" ? input.routing : null,
  };
}
