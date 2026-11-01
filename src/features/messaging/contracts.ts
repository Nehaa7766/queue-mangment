import { z } from "zod";
import type { TokenStatus } from "@/features/queue/token-status";

// Shared contract between the messaging API and the patient and staff
// screens (docs/MESSAGING.md). Client-safe: no server imports. Change it only
// in ways both sides can follow. All timestamps are ISO 8601 strings.

export const CHANNELS = ["RECEPTION", "DOCTOR"] as const;
export type Channel = (typeof CHANNELS)[number];

export type MessageSender = "PATIENT" | "STAFF";

export const MESSAGE_MAX_LENGTH = 1000;
// Messages per page, newest page first; older pages via ?before=<messageId>.
export const MESSAGE_PAGE_SIZE = 50;
export const INBOX_PAGE_SIZE = 30;
// A chat turns read-only this long after the visit ends (completed,
// cancelled or no-show), or a day after the patient joined.
export const CLOSE_AFTER_VISIT_MS = 2 * 60 * 60_000;
export const CLOSE_AFTER_JOIN_MS = 24 * 60 * 60_000;

// ---- Request bodies ----

// Trims, turns \r\n into \n, drops control characters other than newlines
// and tabs, and collapses runs of more than two blank lines. Text only: the
// screens render it as plain text, never as HTML.
export function normalizeMessageBody(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const messageBodySchema = z
  .string()
  .transform(normalizeMessageBody)
  .pipe(
    z
      .string()
      .min(1, "Write a message first.")
      .max(MESSAGE_MAX_LENGTH, "Keep it under 1,000 characters."),
  );

// clientMessageId: a fresh crypto.randomUUID() per message, reused when the
// screen retries it, so a retry never stores a second copy.
export const sendMessageBodySchema = z.object({
  clientMessageId: z.uuid(),
  body: messageBodySchema,
});
export type SendMessageBody = z.input<typeof sendMessageBodySchema>;

// serviceIds empty means every service. idempotencyKey: a fresh UUID per
// announcement, reused on retry.
export const createBroadcastBodySchema = z.object({
  idempotencyKey: z.uuid(),
  body: messageBodySchema,
  serviceIds: z.array(z.uuid()).max(50),
});
export type CreateBroadcastBody = z.input<typeof createBroadcastBodySchema>;

export const INBOX_FILTERS = ["all", "unread", "open", "closed"] as const;
export type InboxFilter = (typeof INBOX_FILTERS)[number];

// ---- Views ----

export type MessageView = {
  id: string;
  clientMessageId: string;
  sender: MessageSender;
  // Staff messages: who wrote it, as the viewer may see it. Patients see
  // "Reception" for the desk and the doctor's own name for doctors; staff
  // see the staff member's name. Null for patient messages.
  senderName: string | null;
  body: string;
  createdAt: string;
  // The other side has read it (their last read time is at or after it).
  seen: boolean;
  // Part of an announcement sent to several patients.
  isAnnouncement: boolean;
};

// Who is answering a patient's doctor chat right now (docs/MESSAGING.md §Routing).
export type DoctorRouting =
  // The doctor who started the consultation.
  | { kind: "ASSIGNED_DOCTOR"; doctorName: string }
  // Before the consultation: the doctors who serve the token's service.
  | { kind: "SERVICE_DOCTORS"; serviceName: string }
  // No doctor serves the service: reception answers instead.
  | { kind: "RECEPTION_FALLBACK" };

export type ConversationState = {
  // Null until the first message.
  conversationId: string | null;
  channel: Channel;
  closed: boolean;
  // Unread for whoever is asking.
  unread: number;
  // DOCTOR channel only.
  routing: DoctorRouting | null;
};

export type MessagePage = {
  conversation: ConversationState;
  // Oldest first.
  messages: MessageView[];
  hasOlder: boolean;
  // Staff pages only: the chat's token, so the header can show it when the
  // chat isn't in the loaded inbox (e.g. opened from "Message patient").
  token?: InboxItem["token"];
};

// The patient's token page: one entry per channel, for the two tabs.
export type PatientMessagingSummary = {
  reception: ConversationState;
  doctor: ConversationState;
};

export type InboxItem = {
  conversationId: string;
  channel: Channel;
  token: {
    id: string;
    label: string;
    status: TokenStatus;
    serviceName: string;
    patientName: string | null;
    queueId: string;
  };
  // Preview, at most 120 characters.
  lastMessage: {
    body: string;
    sender: MessageSender;
    createdAt: string;
  } | null;
  unread: number;
  closed: boolean;
  routing: DoctorRouting | null;
};

export type InboxPage = {
  items: InboxItem[];
  // Pass as ?cursor= for the next page; null when there are no more.
  nextCursor: string | null;
};

// Unread chats for the staff member's nav badge.
export type UnreadSummary = { conversations: number };

export type BroadcastAudience = {
  // Patients who would get it now: waiting or called today.
  eligible: number;
  services: {
    serviceId: string;
    name: string;
    tokenPrefix: string;
    eligible: number;
  }[];
};

export type BroadcastRecipientStatus =
  "PENDING" | "SENT" | "SKIPPED" | "FAILED";

export const BROADCAST_SKIP_REASONS = {
  VISIT_ENDED: "Visit had ended",
  IN_CONSULTATION: "Already with the doctor",
  CHAT_CLOSED: "Chat was closed",
} as const;
export type BroadcastSkipReason = keyof typeof BROADCAST_SKIP_REASONS;

export type BroadcastSummary = {
  id: string;
  body: string;
  createdAt: string;
  createdByName: string | null;
  // Empty means every service.
  serviceNames: string[];
  status: "SENDING" | "DONE";
  counts: {
    total: number;
    pending: number;
    sent: number;
    skipped: number;
    failed: number;
    // Sent and read by the patient.
    seen: number;
  };
};

export type BroadcastDetail = BroadcastSummary & {
  recipients: {
    tokenId: string;
    tokenLabel: string;
    patientName: string | null;
    serviceName: string;
    status: BroadcastRecipientStatus;
    skipReason: BroadcastSkipReason | null;
    seen: boolean;
  }[];
};

// ---- Live events (Server-Sent Events) ----
//
// The streams carry hints only, never message text: on an event the screen
// refetches through the REST endpoints, which check access every time. The
// server sends `event: messaging` with one of these as JSON data, plus a
// comment line every 25 seconds to keep the connection open. Streams end
// after a few minutes; EventSource reconnects and the screen refetches.
export type MessagingEvent =
  // New message in a conversation the viewer can see.
  | { type: "message"; conversationId: string; channel: Channel }
  // The other side read the conversation (update "Seen").
  | { type: "read"; conversationId: string; channel: Channel }
  // Routing or open/closed state changed, e.g. a doctor started the visit.
  | { type: "conversation"; conversationId: string; channel: Channel }
  // Staff only: an announcement's progress changed.
  | { type: "broadcast"; broadcastId: string };

export const MESSAGING_EVENT_NAME = "messaging";

// ---- Endpoints ----

const channelSegment = (channel: Channel) => channel.toLowerCase();

export const MESSAGING_API = {
  // Patient (the private token link is the credential).
  patientSummary: (publicTokenId: string) =>
    `/api/public/tokens/${publicTokenId}/messages`,
  // GET ?before=<messageId> → MessagePage; POST SendMessageBody → MessageView.
  patientMessages: (publicTokenId: string, channel: Channel) =>
    `/api/public/tokens/${publicTokenId}/messages/${channelSegment(channel)}`,
  // POST → { ok: true }
  patientRead: (publicTokenId: string, channel: Channel) =>
    `/api/public/tokens/${publicTokenId}/messages/${channelSegment(channel)}/read`,
  // GET text/event-stream
  patientEvents: (publicTokenId: string) =>
    `/api/public/tokens/${publicTokenId}/messages/events`,

  // Staff (session cookie).
  // GET ?filter=<InboxFilter>&channel=<reception|doctor>&q=<text>&cursor= → InboxPage
  inbox: "/api/messages/conversations",
  // GET ?before=<messageId> → MessagePage; POST SendMessageBody → MessageView.
  conversationMessages: (conversationId: string) =>
    `/api/messages/conversations/${conversationId}/messages`,
  // POST → { ok: true }
  conversationRead: (conversationId: string) =>
    `/api/messages/conversations/${conversationId}/read`,
  // POST → { conversationId } (finds or creates the chat for a token).
  startConversation: (tokenId: string, channel: Channel) =>
    `/api/messages/tokens/${tokenId}/${channelSegment(channel)}`,
  // GET → UnreadSummary
  unread: "/api/messages/unread",
  // GET text/event-stream
  staffEvents: "/api/messages/events",

  // Announcements: GET → BroadcastSummary[] (newest first, 50);
  // POST CreateBroadcastBody → BroadcastSummary (201, or 200 on a retry).
  broadcasts: "/api/messages/announcements",
  // GET ?serviceIds=a,b → BroadcastAudience
  broadcastAudience: "/api/messages/announcements/audience",
  // GET → BroadcastDetail
  broadcast: (broadcastId: string) =>
    `/api/messages/announcements/${broadcastId}`,
} as const;

export function channelFromSegment(segment: string): Channel | null {
  const upper = segment.toUpperCase();
  return (CHANNELS as readonly string[]).includes(upper)
    ? (upper as Channel)
    : null;
}
