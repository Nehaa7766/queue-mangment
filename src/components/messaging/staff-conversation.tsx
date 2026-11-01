"use client";

import { ArrowLeftIcon, LockIcon, StethoscopeIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { TokenBadge } from "@/components/dashboard/list-row";
import { useStaff } from "@/components/layout/staff-provider";
import { TokenStatusPill } from "@/components/queue/status-pill";
import { displayName } from "@/components/queue/token-display";
import { Button } from "@/components/ui/button";
import { MESSAGING_API, type InboxItem } from "@/features/messaging/contracts";
import { ChatPanel } from "./chat-panel";
import { ChatEmpty } from "./chat-states";
import { ConnectionStatus } from "./connection-status";
import type { ChatItem } from "./merge";
import { useStaffMessaging } from "./staff-messaging";
import { CHANNEL_LABELS, staffRoutingText } from "./staff-format";
import { useConversation } from "./use-conversation";

const CLOSED_NOTE =
  "This chat is closed and read-only. Chats close 2 hours after the visit ends, or a day after the patient joined.";

// The open chat on the staff Messages page: who it is with, the history and
// the composer. Key it by conversation id.
export function StaffConversation({
  conversationId,
  item,
  onBack,
  onRead,
  onSent,
  focusOnOpen,
}: {
  conversationId: string;
  // From the inbox; null when the chat isn't in the loaded list.
  item: InboxItem | null;
  onBack: () => void;
  onRead: () => void;
  onSent: () => void;
  // Phones show one screen at a time; move focus to the new one.
  focusOnOpen: boolean;
}) {
  const { user, role } = useStaff();
  const { subscribe, stream } = useStaffMessaging();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const chat = useConversation({
    messagesUrl: MESSAGING_API.conversationMessages(conversationId),
    readUrl: MESSAGING_API.conversationRead(conversationId),
    // Per staff member, so a shared desk computer never sends one person's
    // unsent message as someone else.
    scope: `staff:${user.userId}:${conversationId}`,
    viewer: "STAFF",
    active: true,
    subscribe,
    isRelevant: (event) =>
      event.type !== "broadcast" && event.conversationId === conversationId,
    onRead,
    onSent,
  });

  useEffect(() => {
    if (focusOnOpen) headingRef.current?.focus();
  }, [focusOnOpen]);

  // The inbox entry when loaded, otherwise the token the page itself sent
  // (a chat opened from "Message patient" may not be in the first page).
  const token = item?.token ?? chat.token;
  const patient = token ? displayName(token.patientName) : "Patient";
  const channel = chat.conversation?.channel ?? item?.channel ?? null;
  const routing = chat.conversation?.routing ?? item?.routing ?? null;
  const closed = chat.conversation?.closed ?? item?.closed ?? false;
  const reception = role !== "DOCTOR";

  const senderOf = (entry: ChatItem): string => {
    if (!entry.mine) return patient;
    return entry.kind === "message"
      ? (entry.message.senderName ?? "Staff")
      : user.name;
  };

  return (
    <>
      <header className="flex flex-col gap-2 border-b border-divider px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            className="size-10 shrink-0 rounded-btn md:hidden"
            onClick={onBack}
          >
            <ArrowLeftIcon aria-hidden className="size-5" />
            <span className="sr-only">Back to chats</span>
          </Button>
          {token && (
            <TokenBadge label={token.label} tone={closed ? "muted" : "brand"} />
          )}
          <div className="min-w-0 flex-1">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="truncate text-[15px] font-semibold outline-none"
            >
              {token ? (
                <>
                  <span className="sr-only">Chat with </span>
                  {patient}
                  <span className="sr-only">, token {token.label}</span>
                </>
              ) : (
                "Chat"
              )}
            </h2>
            <p className="truncate text-xs text-muted-foreground">
              {[token?.serviceName, channel && CHANNEL_LABELS[channel]]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <ConnectionStatus snapshot={stream} className="shrink-0" />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          {token && <TokenStatusPill status={token.status} />}
          {closed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-status-off px-2.5 py-0.5 font-semibold text-status-off-foreground">
              <LockIcon aria-hidden className="size-3" />
              Closed
            </span>
          )}
          {channel === "DOCTOR" && routing && (
            <span className="inline-flex items-center gap-1">
              <StethoscopeIcon aria-hidden className="size-3.5 text-brand" />
              {staffRoutingText(routing)}
            </span>
          )}
          {reception && token && (
            <Link
              href={`/receptionist/tokens/${token.id}`}
              className="ml-auto font-medium text-brand underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Token details
            </Link>
          )}
        </div>
      </header>
      <ChatPanel
        className="min-h-0 flex-1"
        chat={chat}
        stream={stream}
        senderOf={senderOf}
        loadingLabel="Loading messages…"
        closedNote={CLOSED_NOTE}
        empty={
          <ChatEmpty
            title="No messages yet"
            body={`Write to ${patient}. They see it on their token page.`}
          />
        }
      />
    </>
  );
}
