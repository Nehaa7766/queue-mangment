"use client";

import {
  createContext,
  use,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { MESSAGING_API } from "@/features/messaging/contracts";
import { fetchUnread } from "./api";
import { useRefresher } from "./refresher";
import type { StreamSnapshot, StreamSubscribe } from "./stream";
import { useMessagingStream, useStreamListener } from "./use-messaging-stream";

export type StaffMessaging = {
  stream: StreamSnapshot;
  // Live hints for every chat (and announcement) this staff member can see.
  subscribe: StreamSubscribe;
  // Chats with something unread, for the nav badge. Null until loaded.
  unread: number | null;
  refreshUnread: () => void;
};

const StaffMessagingContext = createContext<StaffMessaging | null>(null);

// One staff event stream per tab, shared by the nav badge, the Messages page
// and anything else that wants live messaging hints (announcement progress,
// for example), so a tab never holds more than one connection.
export function StaffMessagingProvider({ children }: { children: ReactNode }) {
  const { snapshot, subscribe } = useMessagingStream(MESSAGING_API.staffEvents);
  const [unread, setUnread] = useState<number | null>(null);
  const refresher = useRefresher(async () => {
    try {
      const summary = await fetchUnread();
      setUnread(summary.conversations);
    } catch {
      // Keep the last count; the next event or reconnect tries again.
    }
  }, 400);

  useEffect(() => {
    void refresher.run();
  }, [refresher]);

  useStreamListener(subscribe, {
    onEvent: (event) => {
      if (event.type !== "broadcast") refresher.schedule();
    },
    onOpen: () => refresher.schedule(),
  });

  const value = useMemo<StaffMessaging>(
    () => ({
      stream: snapshot,
      subscribe,
      unread,
      refreshUnread: () => refresher.schedule(),
    }),
    [snapshot, subscribe, unread, refresher],
  );

  return (
    <StaffMessagingContext value={value}>{children}</StaffMessagingContext>
  );
}

export function useStaffMessaging(): StaffMessaging {
  const value = use(StaffMessagingContext);
  if (!value) {
    throw new Error("useStaffMessaging must be used inside the staff shell.");
  }
  return value;
}
