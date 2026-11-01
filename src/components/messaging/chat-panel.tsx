"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChatSettings, type ChatCopy } from "./chat-context";
import { ChatLoadError, ChatSkeleton } from "./chat-states";
import { Composer } from "./composer";
import { ConnectionNote } from "./connection-status";
import type { ChatItem } from "./merge";
import { MessageList } from "./message-list";
import type { StreamSnapshot } from "./stream";
import type { Conversation } from "./use-conversation";

const ANNOUNCE_MAX_CHARS = 160;

// What screen readers hear when the newest item changes: a message from the
// other side, or what happened to the viewer's own latest message. Messages
// already there when the chat opened are not announced.
function liveText(
  items: ChatItem[],
  baselineId: string | null,
  senderOf: (item: ChatItem) => string,
  copy: ChatCopy,
): string {
  const last = items.at(-1);
  if (!last) return "";
  if (last.kind === "pending") {
    return last.pending.status === "failed" ? copy.announce.failed : "";
  }
  if (last.message.id === baselineId) return "";
  if (last.mine) {
    return last.message.seen ? copy.announce.seen : copy.announce.sent;
  }
  const body =
    last.message.body.length > ANNOUNCE_MAX_CHARS
      ? `${last.message.body.slice(0, ANNOUNCE_MAX_CHARS)}…`
      : last.message.body;
  return copy.announce.newMessage(senderOf(last), body);
}

// History, connection note, composer and the loading, error, empty and
// closed states for one chat.
export function ChatPanel({
  chat,
  stream,
  senderOf,
  empty,
  closedNote,
  loadingLabel,
  className,
}: {
  chat: Conversation;
  stream: StreamSnapshot;
  senderOf: (item: ChatItem) => string;
  empty: ReactNode;
  // Why the chat is read-only, shown in place of a working composer.
  closedNote: ReactNode;
  loadingLabel: string;
  className?: string;
}) {
  const { copy } = useChatSettings();
  const closed = chat.conversation?.closed ?? false;
  // Access can end (a doctor loses a visit): stop showing the history then.
  const unavailable = chat.loadError === "unavailable";
  const ready = chat.history !== null && !unavailable;

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <ConnectionNote snapshot={stream} />
      {chat.history === null || unavailable ? (
        chat.loadError ? (
          <ChatLoadError error={chat.loadError} onRetry={chat.reload} />
        ) : (
          <ChatSkeleton label={loadingLabel} />
        )
      ) : (
        <>
          {chat.loadError === "failed" && (
            <p
              role="alert"
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-divider bg-status-miss px-4 py-2 text-sm text-status-miss-foreground"
            >
              {copy.loadFailed.title}
              <Button
                variant="outline"
                className="h-9 rounded-btn bg-card px-3"
                onClick={chat.reload}
              >
                {copy.loadFailed.retry}
              </Button>
            </p>
          )}
          <MessageList
            items={chat.items}
            hasOlder={chat.history.hasOlder}
            loadingOlder={chat.loadingOlder}
            olderFailed={chat.olderFailed}
            onLoadOlder={chat.loadOlder}
            onRetry={chat.retry}
            onRemove={chat.remove}
            senderOf={senderOf}
            empty={empty}
          />
        </>
      )}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {ready ? liveText(chat.items, chat.baselineId, senderOf, copy) : ""}
      </p>
      {ready && (
        <Composer
          onSend={chat.send}
          closedNote={closed ? closedNote : undefined}
        />
      )}
    </div>
  );
}
