import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import {
  chatTokenSelect,
  conversationSelect,
  coversService,
  findPatientToken,
  loadServiceCoverage,
  resolveRouting,
  staffConversationWhere,
  toDoctorRouting,
  type ConversationRow,
  type StaffChat,
  type StaffMember,
} from "./access";
import {
  CLOSE_AFTER_JOIN_MS,
  CLOSE_AFTER_VISIT_MS,
  INBOX_FILTERS,
  INBOX_PAGE_SIZE,
  MESSAGE_PAGE_SIZE,
  channelFromSegment,
  type Channel,
  type InboxFilter,
  type InboxItem,
  type InboxPage,
  type MessagePage,
  type MessageView,
  type PatientMessagingSummary,
  type UnreadSummary,
} from "./contracts";
import {
  decodeInboxCursor,
  encodeInboxCursor,
  type InboxCursor,
} from "./inbox-cursor";
import { doctorRoutingKind, isConversationClosed, previewText } from "./rules";
import {
  messageSelect,
  toConversationState,
  toMessageView,
  type Side,
} from "./views";

// Messaging reads. REST is the only path that returns message text, and
// every call checks access again (the live streams carry hints only).

type Db = Prisma.TransactionClient;

const uuidSchema = z.uuid();

// ---- Message pages ----

// Newest MESSAGE_PAGE_SIZE messages before `before` (a message id in this
// chat), returned oldest first.
async function loadMessages(
  db: Db,
  conversation: ConversationRow | null,
  clinicId: string,
  viewer: Side,
  before: string | null,
): Promise<{ messages: MessageView[]; hasOlder: boolean }> {
  if (!conversation) {
    if (before) throw invalidBefore();
    return { messages: [], hasOlder: false };
  }

  let olderThan: Prisma.MessageWhereInput = {};
  if (before) {
    const anchor = uuidSchema.safeParse(before).success
      ? await db.message.findFirst({
          where: { id: before, conversationId: conversation.id },
          select: { id: true, createdAt: true },
        })
      : null;
    if (!anchor) throw invalidBefore();
    olderThan = {
      OR: [
        { createdAt: { lt: anchor.createdAt } },
        { createdAt: anchor.createdAt, id: { lt: anchor.id } },
      ],
    };
  }

  const rows = await db.message.findMany({
    where: { conversationId: conversation.id, ...olderThan },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MESSAGE_PAGE_SIZE + 1,
    select: messageSelect(clinicId),
  });
  return {
    messages: rows
      .slice(0, MESSAGE_PAGE_SIZE)
      .reverse()
      .map((row) =>
        toMessageView(row, conversation.channel, viewer, conversation),
      ),
    hasOlder: rows.length > MESSAGE_PAGE_SIZE,
  };
}

function invalidBefore(): AppError {
  return new AppError(
    "VALIDATION_ERROR",
    "The message to load from is not in this chat.",
  );
}

export async function getPatientMessagePage(
  publicTokenId: string,
  channel: Channel,
  before: string | null,
): Promise<MessagePage> {
  const db = getDb();
  const token = await findPatientToken(publicTokenId);
  const conversation = await db.conversation.findUnique({
    where: { tokenId_channel: { tokenId: token.id, channel } },
    select: conversationSelect,
  });
  const routing = toDoctorRouting(
    await resolveRouting(db, token, channel),
    token,
  );
  const page = await loadMessages(
    db,
    conversation,
    token.clinicId,
    "PATIENT",
    before,
  );
  return {
    conversation: toConversationState({
      conversation,
      channel,
      closed: isConversationClosed(token),
      viewer: "PATIENT",
      routing,
    }),
    ...page,
  };
}

export async function getStaffMessagePage(
  chat: StaffChat,
  before: string | null,
): Promise<MessagePage> {
  const page = await loadMessages(
    getDb(),
    chat.conversation,
    chat.token.clinicId,
    "STAFF",
    before,
  );
  return {
    conversation: toConversationState({
      conversation: chat.conversation,
      channel: chat.conversation.channel,
      closed: isConversationClosed(chat.token),
      viewer: "STAFF",
      routing: toDoctorRouting(chat.routing, chat.token),
    }),
    ...page,
    token: {
      id: chat.token.id,
      label: chat.token.tokenLabel,
      status: chat.token.status,
      serviceName: chat.token.service.name,
      patientName: chat.token.patientName,
      queueId: chat.token.queueId,
    },
  };
}

// The two tabs on the patient's token page.
export async function getPatientSummary(
  publicTokenId: string,
): Promise<PatientMessagingSummary> {
  const db = getDb();
  const token = await findPatientToken(publicTokenId);
  const conversations = await db.conversation.findMany({
    where: { tokenId: token.id },
    select: conversationSelect,
  });
  const find = (channel: Channel) =>
    conversations.find((row) => row.channel === channel) ?? null;
  const closed = isConversationClosed(token);
  return {
    reception: toConversationState({
      conversation: find("RECEPTION"),
      channel: "RECEPTION",
      closed,
      viewer: "PATIENT",
      routing: null,
    }),
    doctor: toConversationState({
      conversation: find("DOCTOR"),
      channel: "DOCTOR",
      closed,
      viewer: "PATIENT",
      routing: toDoctorRouting(
        await resolveRouting(db, token, "DOCTOR"),
        token,
      ),
    }),
  };
}

// ---- Inbox ----

export type InboxQuery = {
  filter: InboxFilter;
  channel: Channel | null;
  q: string | null;
  cursor: InboxCursor | null;
};

const SEARCH_MAX_LENGTH = 80;

// ?filter=<InboxFilter>&channel=<reception|doctor>&q=<text>&cursor=
export function parseInboxQuery(params: URLSearchParams): InboxQuery {
  const filter = params.get("filter") || "all";
  if (!(INBOX_FILTERS as readonly string[]).includes(filter)) {
    throw new AppError("VALIDATION_ERROR", "Unknown inbox filter.");
  }
  const channelParam = params.get("channel");
  const channel = channelParam ? channelFromSegment(channelParam) : null;
  if (channelParam && !channel) {
    throw new AppError("VALIDATION_ERROR", "Unknown channel.");
  }
  const cursorParam = params.get("cursor");
  const cursor = cursorParam ? decodeInboxCursor(cursorParam) : null;
  if (cursorParam && !cursor) {
    throw new AppError("VALIDATION_ERROR", "The page cursor is invalid.");
  }
  const q = params.get("q")?.trim().slice(0, SEARCH_MAX_LENGTH) || null;
  return { filter: filter as InboxFilter, channel, q, cursor };
}

// Same rule as isConversationClosed, as a filter on the token.
export function closedTokenWhere(now: Date): Prisma.QueueTokenWhereInput {
  const joinCutoff = new Date(now.getTime() - CLOSE_AFTER_JOIN_MS);
  const visitCutoff = new Date(now.getTime() - CLOSE_AFTER_VISIT_MS);
  return {
    OR: [
      { joinedAt: { lte: joinCutoff } },
      { status: "COMPLETED", completedAt: { lte: visitCutoff } },
      { status: "CANCELLED", cancelledAt: { lte: visitCutoff } },
      { status: "SKIPPED", skippedAt: { lte: visitCutoff } },
    ],
  };
}

export function openTokenWhere(now: Date): Prisma.QueueTokenWhereInput {
  const joinCutoff = new Date(now.getTime() - CLOSE_AFTER_JOIN_MS);
  const visitCutoff = new Date(now.getTime() - CLOSE_AFTER_VISIT_MS);
  return {
    joinedAt: { gt: joinCutoff },
    OR: [
      { status: { in: ["WAITING", "CALLED", "IN_SERVICE"] } },
      { status: "COMPLETED", completedAt: { gt: visitCutoff } },
      { status: "CANCELLED", cancelledAt: { gt: visitCutoff } },
      { status: "SKIPPED", skippedAt: { gt: visitCutoff } },
    ],
  };
}

function afterCursor(cursor: InboxCursor): Prisma.ConversationWhereInput {
  if (cursor.lastMessageAt === null) {
    return { lastMessageAt: null, id: { lt: cursor.id } };
  }
  const at = new Date(cursor.lastMessageAt);
  return {
    OR: [
      { lastMessageAt: { lt: at } },
      { lastMessageAt: at, id: { lt: cursor.id } },
      { lastMessageAt: null },
    ],
  };
}

// Chats the staff member may see, newest activity first. Access is part of
// the query, so a page never holds chats that are filtered out afterwards.
export async function getInbox(
  member: StaffMember,
  query: InboxQuery,
  now: Date = new Date(),
): Promise<InboxPage> {
  const db = getDb();
  const filters: Prisma.ConversationWhereInput[] = [
    await staffConversationWhere(db, member),
  ];
  if (query.channel) filters.push({ channel: query.channel });
  if (query.filter === "unread") filters.push({ unreadByStaff: { gt: 0 } });
  if (query.filter === "open") filters.push({ token: openTokenWhere(now) });
  if (query.filter === "closed") filters.push({ token: closedTokenWhere(now) });
  if (query.q) {
    filters.push({
      token: {
        OR: [
          { tokenLabel: { contains: query.q, mode: "insensitive" } },
          { patientName: { contains: query.q, mode: "insensitive" } },
        ],
      },
    });
  }
  if (query.cursor) filters.push(afterCursor(query.cursor));

  const rows = await db.conversation.findMany({
    where: { AND: filters },
    orderBy: [
      { lastMessageAt: { sort: "desc", nulls: "last" } },
      { id: "desc" },
    ],
    take: INBOX_PAGE_SIZE + 1,
    select: {
      ...conversationSelect,
      token: { select: chatTokenSelect },
      messages: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1,
        select: { body: true, sender: true, createdAt: true },
      },
    },
  });
  const page = rows.slice(0, INBOX_PAGE_SIZE);
  const coverage = page.some(
    (row) => row.channel === "DOCTOR" && !row.token.assignedDoctorId,
  )
    ? await loadServiceCoverage(db, member.clinicId)
    : null;

  const items = page.map((row): InboxItem => {
    const last = row.messages[0];
    const routing =
      row.channel === "DOCTOR"
        ? doctorRoutingKind(
            row.token.assignedDoctorId,
            coverage ? coversService(coverage, row.token.serviceId) : true,
          )
        : null;
    return {
      conversationId: row.id,
      channel: row.channel,
      token: {
        id: row.token.id,
        label: row.token.tokenLabel,
        status: row.token.status,
        serviceName: row.token.service.name,
        patientName: row.token.patientName,
        queueId: row.token.queueId,
      },
      lastMessage: last
        ? {
            body: previewText(last.body),
            sender: last.sender,
            createdAt: last.createdAt.toISOString(),
          }
        : null,
      unread: row.unreadByStaff,
      closed: isConversationClosed(row.token, now),
      routing: toDoctorRouting(routing, row.token),
    };
  });

  const lastRow = page.at(-1);
  return {
    items,
    nextCursor:
      rows.length > INBOX_PAGE_SIZE && lastRow
        ? encodeInboxCursor({
            lastMessageAt: lastRow.lastMessageAt?.toISOString() ?? null,
            id: lastRow.id,
          })
        : null,
  };
}

// Chats with unread patient messages, for the nav badge.
export async function getUnreadSummary(
  member: StaffMember,
): Promise<UnreadSummary> {
  const db = getDb();
  const conversations = await db.conversation.count({
    where: {
      AND: [
        await staffConversationWhere(db, member),
        { unreadByStaff: { gt: 0 } },
      ],
    },
  });
  return { conversations };
}
