"use client";

import { ArrowDownIcon } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChatSettings } from "./chat-context";
import { deliveryStatus, type ChatItem, type DeliveryStatus } from "./merge";
import { MessageBubble } from "./message-bubble";

// Within this distance of the end counts as "at the bottom".
const BOTTOM_SLACK_PX = 48;

// The chat history, oldest first, in its own scroll area. It opens at the
// newest message and follows new ones while the reader is at the bottom or
// has just sent something; someone reading older messages stays where they
// are and gets a "New messages" button instead. Loading older messages keeps
// the visible ones in place.
export function MessageList({
  items,
  hasOlder,
  loadingOlder,
  olderFailed,
  onLoadOlder,
  onRetry,
  onRemove,
  senderOf,
  empty,
  className,
}: {
  items: ChatItem[];
  hasOlder: boolean;
  loadingOlder: boolean;
  olderFailed: boolean;
  onLoadOlder: () => void;
  onRetry: (clientMessageId: string) => void;
  onRemove: (clientMessageId: string) => void;
  senderOf: (item: ChatItem) => string;
  empty: ReactNode;
  className?: string;
}) {
  const { copy, variant } = useChatSettings();
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const anchorRef = useRef<{ height: number; top: number } | null>(null);
  const previousRef = useRef<{
    first?: string;
    last?: string;
    status?: DeliveryStatus;
  } | null>(null);
  const lastKeyRef = useRef<string | undefined>(undefined);
  const [atBottom, setAtBottom] = useState(true);
  const [seenLastKey, setSeenLastKey] = useState<string | undefined>();

  const firstKey = items[0]?.key;
  const last = items.at(-1);
  const lastKey = last?.key;
  const lastMine = last?.mine ?? false;
  // A failed send grows (reason, Retry); keep it in view.
  const lastStatus = last ? deliveryStatus(last) : undefined;

  useEffect(() => {
    lastKeyRef.current = lastKey;
  }, [lastKey]);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const previous = previousRef.current;
    previousRef.current = {
      first: firstKey,
      last: lastKey,
      status: lastStatus,
    };
    // First messages: open at the newest.
    if (!previous?.last) {
      element.scrollTop = element.scrollHeight;
      return;
    }
    // Older messages above: keep what was on screen where it was.
    const anchor = anchorRef.current;
    if (anchor && firstKey !== previous.first) {
      element.scrollTop = anchor.top + (element.scrollHeight - anchor.height);
      anchorRef.current = null;
      return;
    }
    const added = lastKey !== previous.last;
    const changed = !added && lastStatus !== previous.status;
    if (
      (added && (atBottomRef.current || lastMine)) ||
      (changed && atBottomRef.current)
    ) {
      element.scrollTop = element.scrollHeight;
    }
  }, [firstKey, lastKey, lastMine, lastStatus]);

  function handleScroll() {
    const element = scrollRef.current;
    if (!element) return;
    const bottom =
      element.scrollHeight - element.scrollTop - element.clientHeight <
      BOTTOM_SLACK_PX;
    atBottomRef.current = bottom;
    setAtBottom(bottom);
    if (bottom) setSeenLastKey(lastKeyRef.current);
  }

  function loadOlder() {
    const element = scrollRef.current;
    if (element) {
      anchorRef.current = {
        height: element.scrollHeight,
        top: element.scrollTop,
      };
    }
    onLoadOlder();
  }

  function jumpToLatest() {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }

  const showJump =
    !atBottom && lastKey !== undefined && lastKey !== seenLastKey && !lastMine;

  return (
    <div className={cn("relative flex min-h-0 flex-1 flex-col", className)}>
      <div
        ref={scrollRef}
        role="region"
        aria-label={copy.history}
        // Scrollable areas must be reachable by keyboard.
        tabIndex={0}
        onScroll={handleScroll}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 py-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset sm:px-4"
      >
        {hasOlder && (
          <div className="mb-4 flex flex-col items-center gap-1">
            <Button
              variant="outline"
              className="h-10 rounded-full px-4 text-xs sm:h-8"
              disabled={loadingOlder}
              onClick={loadOlder}
            >
              {loadingOlder ? copy.loadingOlder : copy.loadOlder}
            </Button>
            {olderFailed && (
              <p role="alert" className="text-xs text-destructive">
                {copy.olderFailed}
              </p>
            )}
          </div>
        )}
        {items.length === 0 && !hasOlder ? (
          empty
        ) : (
          // Few messages sit at the bottom, next to the composer.
          <ol className="mt-auto flex flex-col gap-3">
            {items.map((item, index) => {
              const previous = items[index - 1];
              const sender = senderOf(item);
              return (
                <MessageBubble
                  key={item.key}
                  item={item}
                  sender={sender}
                  showSender={
                    // Patients know their own messages; staff see which
                    // colleague wrote each one.
                    (!item.mine || variant === "staff") &&
                    (!previous ||
                      previous.mine !== item.mine ||
                      senderOf(previous) !== sender)
                  }
                  onRetry={onRetry}
                  onRemove={onRemove}
                />
              );
            })}
          </ol>
        )}
      </div>
      {showJump && (
        <Button
          className="absolute bottom-3 left-1/2 h-10 -translate-x-1/2 rounded-full px-4 shadow-card sm:h-9"
          onClick={jumpToLatest}
        >
          <ArrowDownIcon aria-hidden />
          {copy.jumpToLatest}
        </Button>
      )}
    </div>
  );
}
