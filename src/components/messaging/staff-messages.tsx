"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { useStaff } from "@/components/layout/staff-provider";
import { useNow } from "@/components/queue/use-now";
import { useShellInfo } from "@/components/shell/shell-context";
import type { Channel, InboxFilter } from "@/features/messaging/contracts";
import { cn } from "@/lib/utils";
import {
  ChatSettingsProvider,
  STAFF_CHAT_COPY,
  type ChatSettings,
} from "./chat-context";
import { ChatEmpty } from "./chat-states";
import { StaffConversation } from "./staff-conversation";
import { formatMessageTime } from "./staff-format";
import { inboxItemId, StaffInbox } from "./staff-inbox";
import { useStaffMessaging } from "./staff-messaging";
import { useInbox } from "./use-inbox";

const CARD =
  "flex min-h-0 flex-col overflow-hidden rounded-card border border-border bg-card shadow-card";

// Below md one screen shows at a time (list, then chat); from md the two sit
// side by side, sized to the window so each scrolls on its own.
const PANEL_HEIGHT =
  "h-[calc(100svh-16rem)] min-h-[24rem] md:h-auto md:min-h-0";

const isPhone = () =>
  window.matchMedia?.("(max-width: 767px)").matches ?? false;

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function selectedFrom(value: string | null): string | null {
  return value && z.uuid().safeParse(value).success ? value : null;
}

// The staff Messages page (docs/MESSAGING.md "Screens"): inbox and chat. The
// open chat is in the URL (?c=<conversationId>), so links, refresh and the
// browser's back button work; switching chats doesn't reload the page.
export function StaffMessages({ basePath }: { basePath: string }) {
  const { role, clinic } = useStaff();
  const { now: requestNow } = useShellInfo();
  const now = useNow(requestNow, 60_000);
  const { subscribe, stream, refreshUnread } = useStaffMessaging();
  const searchParams = useSearchParams();
  const selectedId = selectedFrom(searchParams.get("c"));

  const [filter, setFilter] = useState<InboxFilter>("all");
  const [channel, setChannel] = useState<Channel | null>(null);
  const [search, setSearch] = useState("");
  const q = useDebounced(search, 300);
  const inbox = useInbox({ filter, channel, q }, subscribe);
  const showChannelFilter = role !== "DOCTOR";

  const settings = useMemo<ChatSettings>(
    () => ({
      copy: STAFF_CHAT_COPY,
      formatTime: (iso) => formatMessageTime(iso, clinic.timezone),
      variant: "staff",
    }),
    [clinic.timezone],
  );

  // Opened from the list on this page: Back returns there through history.
  const openedFromListRef = useRef(false);
  const lastSelectedRef = useRef<string | null>(null);
  const [focusChat, setFocusChat] = useState(false);

  const hrefFor = (id: string) => `${basePath}?c=${id}`;

  function select(id: string) {
    openedFromListRef.current = true;
    lastSelectedRef.current = id;
    setFocusChat(isPhone());
    window.history.pushState(null, "", hrefFor(id));
  }

  function back() {
    if (openedFromListRef.current) {
      openedFromListRef.current = false;
      window.history.back();
    } else {
      window.history.pushState(null, "", basePath);
    }
  }

  // Back on a phone: return focus to the chat that was open.
  useEffect(() => {
    if (selectedId || !lastSelectedRef.current) return;
    if (!isPhone()) return;
    document.getElementById(inboxItemId(lastSelectedRef.current))?.focus();
  }, [selectedId]);

  const selectedItem = selectedId
    ? (inbox.items.find((item) => item.conversationId === selectedId) ??
      inbox.known[selectedId] ??
      null)
    : null;

  return (
    <ChatSettingsProvider value={settings}>
      <div className="grid gap-5 md:h-[calc(100svh-11rem)] md:min-h-[30rem] md:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)] lg:grid-cols-[22rem_minmax(0,1fr)]">
        <section
          aria-labelledby="inbox-title"
          className={cn(CARD, PANEL_HEIGHT, selectedId && "max-md:hidden")}
        >
          <StaffInbox
            inbox={inbox}
            filter={filter}
            onFilterChange={setFilter}
            channel={channel}
            onChannelChange={setChannel}
            showChannelFilter={showChannelFilter}
            search={search}
            onSearchChange={setSearch}
            selectedId={selectedId}
            hrefFor={hrefFor}
            onSelect={select}
            stream={stream}
            timezone={clinic.timezone}
            now={now}
          />
        </section>
        <section
          aria-label="Conversation"
          className={cn(CARD, PANEL_HEIGHT, !selectedId && "max-md:hidden")}
        >
          {selectedId ? (
            <StaffConversation
              key={selectedId}
              conversationId={selectedId}
              item={selectedItem}
              onBack={back}
              focusOnOpen={focusChat}
              onRead={() => {
                inbox.markRead(selectedId);
                refreshUnread();
              }}
              onSent={inbox.refresh}
            />
          ) : (
            <ChatEmpty
              title="Choose a chat"
              body={
                role === "DOCTOR"
                  ? "Pick a patient on the left to read and reply."
                  : "Pick a patient on the left, or use Message on the live queue to write to someone new."
              }
            />
          )}
        </section>
      </div>
    </ChatSettingsProvider>
  );
}
