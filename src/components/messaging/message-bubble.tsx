"use client";

import { MegaphoneIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChatSettings } from "./chat-context";
import { deliveryStatus, type ChatItem } from "./merge";
import { MessageStatus } from "./message-status";

// One message. The viewer's own side is on the right in mocha, the other
// side on the left in grey. Text is plain (React escapes it), keeps its line
// breaks and wraps long words and any script instead of overflowing.
export function MessageBubble({
  item,
  sender,
  showSender,
  onRetry,
  onRemove,
}: {
  item: ChatItem;
  // Who wrote it, as the viewer may see it.
  sender: string;
  // Shown above the first of several messages in a row from one sender.
  showSender: boolean;
  onRetry: (clientMessageId: string) => void;
  onRemove: (clientMessageId: string) => void;
}) {
  const { copy, formatTime, variant } = useChatSettings();
  const { mine } = item;
  const body = item.kind === "message" ? item.message.body : item.pending.body;
  const createdAt =
    item.kind === "message" ? item.message.createdAt : item.pending.createdAt;
  const isAnnouncement = item.kind === "message" && item.message.isAnnouncement;
  const status = deliveryStatus(item);
  const failure = item.kind === "pending" ? item.pending.failure : null;
  const clientMessageId =
    item.kind === "message"
      ? item.message.clientMessageId
      : item.pending.clientMessageId;

  return (
    <li
      className={cn(
        "flex min-w-0 flex-col gap-1",
        mine ? "items-end" : "items-start",
      )}
    >
      {showSender ? (
        <span className="max-w-full truncate px-1 text-xs font-semibold text-muted-foreground">
          {sender}
        </span>
      ) : (
        <span className="sr-only">{sender}:</span>
      )}
      <div
        className={cn(
          "max-w-[85%] min-w-0 rounded-2xl px-3.5 py-2 sm:max-w-[75%]",
          mine
            ? "rounded-br-md bg-brand text-white"
            : "rounded-bl-md bg-muted text-foreground",
          status === "failed" &&
            "outline-2 outline-offset-2 outline-destructive",
        )}
      >
        {isAnnouncement && (
          <span
            className={cn(
              "mb-1 flex items-center gap-1 text-[11px] font-semibold tracking-[0.06em] uppercase",
              mine ? "text-brand-muted" : "text-brand",
            )}
          >
            <MegaphoneIcon aria-hidden className="size-3.5" />
            {copy.announcement}
          </span>
        )}
        <p
          dir="auto"
          className={cn(
            "[overflow-wrap:anywhere] whitespace-pre-wrap",
            variant === "patient" ? "text-base" : "text-[15px] leading-relaxed",
          )}
        >
          {body}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-xs text-muted-foreground">
        <time dateTime={createdAt} className="tabular-nums">
          {formatTime(createdAt)}
        </time>
        {mine && (
          <>
            <span aria-hidden>·</span>
            <MessageStatus status={status} />
          </>
        )}
      </div>
      {status === "failed" && (
        <div className="flex max-w-full flex-wrap items-center justify-end gap-2 px-1">
          {failure && (
            <p className="text-xs text-destructive">{copy.failure[failure]}</p>
          )}
          <span className="flex gap-2">
            <Button
              variant="outline"
              className="h-10 rounded-btn px-3 sm:h-8"
              onClick={() => onRetry(clientMessageId)}
            >
              {copy.retry}
            </Button>
            <Button
              variant="ghost"
              className="h-10 rounded-btn px-3 text-muted-foreground sm:h-8"
              onClick={() => onRemove(clientMessageId)}
            >
              {copy.remove}
            </Button>
          </span>
        </div>
      )}
    </li>
  );
}
