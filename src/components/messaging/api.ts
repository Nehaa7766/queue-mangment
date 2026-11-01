import {
  apiRequest,
  ApiError,
  newIdempotencyKey,
} from "@/components/queue/api-client";
import {
  MESSAGING_API,
  type Channel,
  type InboxFilter,
  type InboxPage,
  type MessagePage,
  type MessageView,
  type PatientMessagingSummary,
  type SendMessageBody,
  type UnreadSummary,
} from "@/features/messaging/contracts";

// Browser-side calls to the messaging API (docs/MESSAGING.md). REST is the
// only path that returns message text; the event streams only say when to
// call these again. Errors arrive as ApiError, like the queue screens.

export { ApiError };

// A fresh id per message, reused on every retry so the server stores it
// once. crypto.randomUUID() only exists on HTTPS and localhost, so plain-HTTP
// LAN setups fall back to the getRandomValues version.
export function newClientMessageId(): string {
  return typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : newIdempotencyKey();
}

// Latest page, or the page before `before` (a message id).
export function fetchMessagePage(
  url: string,
  before?: string,
): Promise<MessagePage> {
  return apiRequest<MessagePage>(
    before ? `${url}?before=${encodeURIComponent(before)}` : url,
  );
}

export function postMessage(
  url: string,
  body: SendMessageBody,
): Promise<MessageView> {
  return apiRequest<MessageView>(url, { method: "POST", body });
}

export function postRead(url: string): Promise<{ ok: true }> {
  return apiRequest<{ ok: true }>(url, { method: "POST" });
}

export function fetchPatientSummary(
  publicTokenId: string,
): Promise<PatientMessagingSummary> {
  return apiRequest<PatientMessagingSummary>(
    MESSAGING_API.patientSummary(publicTokenId),
  );
}

export type InboxQuery = {
  filter: InboxFilter;
  // Null: every channel the staff member can see.
  channel: Channel | null;
  q: string;
};

export function inboxUrl(query: InboxQuery, cursor?: string | null): string {
  const params = new URLSearchParams({ filter: query.filter });
  if (query.channel) params.set("channel", query.channel.toLowerCase());
  const q = query.q.trim();
  if (q) params.set("q", q);
  if (cursor) params.set("cursor", cursor);
  return `${MESSAGING_API.inbox}?${params.toString()}`;
}

export function fetchInbox(
  query: InboxQuery,
  cursor?: string | null,
  signal?: AbortSignal,
): Promise<InboxPage> {
  return apiRequest<InboxPage>(inboxUrl(query, cursor), { signal });
}

export function fetchUnread(): Promise<UnreadSummary> {
  return apiRequest<UnreadSummary>(MESSAGING_API.unread);
}

// Finds or creates the chat for a token; staff only.
export function startConversation(
  tokenId: string,
  channel: Channel,
): Promise<{ conversationId: string }> {
  return apiRequest<{ conversationId: string }>(
    MESSAGING_API.startConversation(tokenId, channel),
    { method: "POST" },
  );
}
