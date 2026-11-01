import type {
  MessagePage,
  MessageSender,
  MessageView,
} from "@/features/messaging/contracts";
import type { PendingMessage } from "./pending-store";

// Pure chat-history rules, shared by the patient and staff screens.

export type History = { messages: MessageView[]; hasOlder: boolean };

function compareMessages(a: MessageView, b: MessageView): number {
  const byTime = Date.parse(a.createdAt) - Date.parse(b.createdAt);
  if (byTime !== 0) return byTime;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// Oldest first, one entry per message. A message seen again (by id, or by
// clientMessageId after a retry) replaces the earlier copy, so "Seen" and
// other changes from a refetch win.
export function mergeMessages(
  current: readonly MessageView[],
  incoming: readonly MessageView[],
): MessageView[] {
  const byId = new Map<string, MessageView>();
  const idByClientId = new Map<string, string>();
  for (const message of [...current, ...incoming]) {
    const earlierId = idByClientId.get(message.clientMessageId);
    if (earlierId !== undefined && earlierId !== message.id) {
      byId.delete(earlierId);
    }
    byId.set(message.id, message);
    idByClientId.set(message.clientMessageId, message.id);
  }
  return [...byId.values()].sort(compareMessages);
}

// A fresh newest page. Older pages already loaded stay, unless the page
// doesn't reach back to them (more than a page arrived while away): then it
// replaces them, so the history never has a silent gap.
export function withLatestPage(
  history: History | null,
  page: MessagePage,
): History {
  if (!history || history.messages.length === 0) {
    return {
      messages: mergeMessages([], page.messages),
      hasOlder: page.hasOlder,
    };
  }
  const known = new Set(history.messages.map((message) => message.id));
  const reachesBack =
    !page.hasOlder ||
    page.messages.length === 0 ||
    page.messages.some((message) => known.has(message.id));
  if (!reachesBack) {
    return { messages: mergeMessages([], page.messages), hasOlder: true };
  }
  return {
    messages: mergeMessages(history.messages, page.messages),
    hasOlder: page.hasOlder && history.hasOlder,
  };
}

export function withOlderPage(history: History, page: MessagePage): History {
  return {
    messages: mergeMessages(history.messages, page.messages),
    hasOlder: page.hasOlder,
  };
}

export function withMessage(
  history: History | null,
  message: MessageView,
): History {
  return {
    messages: mergeMessages(history?.messages ?? [], [message]),
    hasOlder: history?.hasOlder ?? false,
  };
}

// Pending entries the server already has (a retry after a refresh, or a
// response lost on the way back) are dropped.
export function undelivered(
  pending: readonly PendingMessage[],
  messages: readonly MessageView[],
): PendingMessage[] {
  const stored = new Set(messages.map((message) => message.clientMessageId));
  return pending.filter((entry) => !stored.has(entry.clientMessageId));
}

export type ChatItem =
  | { kind: "message"; key: string; mine: boolean; message: MessageView }
  | { kind: "pending"; key: string; mine: true; pending: PendingMessage };

// What the list shows: stored messages, then the viewer's unsent ones. Keys
// follow clientMessageId, so a message keeps its row when it is stored.
export function chatItems(
  messages: readonly MessageView[],
  pending: readonly PendingMessage[],
  viewer: MessageSender,
): ChatItem[] {
  const items: ChatItem[] = messages.map((message) => ({
    kind: "message",
    key: `c:${message.clientMessageId}`,
    mine: message.sender === viewer,
    message,
  }));
  const shown = new Set(messages.map((message) => message.clientMessageId));
  for (const entry of [...pending].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  )) {
    if (shown.has(entry.clientMessageId)) continue;
    items.push({
      kind: "pending",
      key: `c:${entry.clientMessageId}`,
      mine: true,
      pending: entry,
    });
  }
  return items;
}

export type DeliveryStatus = "sending" | "sent" | "seen" | "failed";

export function deliveryStatus(item: ChatItem): DeliveryStatus {
  if (item.kind === "pending") {
    return item.pending.status === "failed" ? "failed" : "sending";
  }
  return item.message.seen ? "seen" : "sent";
}
