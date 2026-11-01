"use client";

import { WifiOffIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useChatSettings } from "./chat-context";
import type { StreamSnapshot, StreamStatus } from "./stream";

const DOT: Record<StreamStatus, string> = {
  connecting: "bg-tone-amber",
  live: "bg-tone-green",
  reconnecting: "bg-tone-amber",
  offline: "bg-muted-foreground",
};

const TEXT: Record<StreamStatus, string> = {
  connecting: "text-status-wait-foreground",
  live: "text-status-done-foreground",
  reconnecting: "text-status-wait-foreground",
  offline: "text-muted-foreground",
};

// Small "Live" / "Reconnecting…" pill for a chat or inbox header. Not a live
// region: the stream reconnects every few minutes by design, and screen
// readers shouldn't hear about each one (ConnectionNote covers real outages).
export function ConnectionStatus({
  snapshot,
  className,
}: {
  snapshot: StreamSnapshot;
  className?: string;
}) {
  const { copy } = useChatSettings();
  return (
    <span
      data-connection={snapshot.status}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap",
        TEXT[snapshot.status],
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("size-2 rounded-full", DOT[snapshot.status])}
      />
      {copy.connection[snapshot.status]}
    </span>
  );
}

// True once the status has stayed the same for `delayMs`.
function useSettled(since: number, delayMs: number): boolean {
  const [settled, setSettled] = useState<number | null>(null);
  useEffect(() => {
    const wait = Math.max(0, since + delayMs - Date.now());
    const timer = window.setTimeout(() => setSettled(since), wait);
    return () => window.clearTimeout(timer);
  }, [since, delayMs]);
  return settled === since;
}

const RECONNECT_NOTE_DELAY_MS = 3_000;

// A line above the chat while offline, or while a reconnect takes longer
// than a moment.
export function ConnectionNote({ snapshot }: { snapshot: StreamSnapshot }) {
  const { copy } = useChatSettings();
  const settled = useSettled(snapshot.since, RECONNECT_NOTE_DELAY_MS);
  const show =
    snapshot.status === "offline" ||
    (snapshot.status === "reconnecting" && settled);
  return (
    <div role="status">
      {show && (
        <p className="flex items-center gap-2 border-b border-divider bg-status-off px-4 py-2 text-sm text-status-off-foreground">
          <WifiOffIcon aria-hidden className="size-4 shrink-0" />
          {snapshot.status === "offline"
            ? copy.connectionNote.offline
            : copy.connectionNote.reconnecting}
        </p>
      )}
    </div>
  );
}
