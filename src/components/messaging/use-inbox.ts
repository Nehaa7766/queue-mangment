"use client";

import { useEffect, useRef, useState } from "react";
import type { InboxItem, InboxPage } from "@/features/messaging/contracts";
import { fetchInbox, inboxUrl, type InboxQuery } from "./api";
import { useRefresher } from "./refresher";
import type { StreamSubscribe } from "./stream";
import { useStreamListener } from "./use-messaging-stream";

type InboxState = {
  // The query these items answer; differs from the current one while a new
  // search or filter loads.
  key: string | null;
  items: InboxItem[];
  nextCursor: string | null;
  // Items from the first page, so a refetch knows which ones it replaces.
  firstPageSize: number;
  pages: number;
  failed: boolean;
  loadingMore: boolean;
  moreFailed: boolean;
  // Every chat seen this visit, so the open chat keeps its header after it
  // leaves the list (e.g. read while "Unread" is selected).
  known: Record<string, InboxItem>;
};

const INITIAL: InboxState = {
  key: null,
  items: [],
  nextCursor: null,
  firstPageSize: 0,
  pages: 0,
  failed: false,
  loadingMore: false,
  moreFailed: false,
  known: {},
};

function remember(
  known: Record<string, InboxItem>,
  items: InboxItem[],
): Record<string, InboxItem> {
  const next = { ...known };
  for (const item of items) next[item.conversationId] = item;
  return next;
}

// A refetched first page. Chats from later pages that the user already
// loaded stay below it, minus any that moved up.
export function withFirstPage(
  state: InboxState,
  key: string,
  page: InboxPage,
): InboxState {
  const base = state.key === key ? state : { ...INITIAL, known: state.known };
  const fresh = new Set(page.items.map((item) => item.conversationId));
  const later =
    base.pages > 1
      ? base.items
          .slice(base.firstPageSize)
          .filter((item) => !fresh.has(item.conversationId))
      : [];
  return {
    ...base,
    key,
    items: [...page.items, ...later],
    nextCursor: base.pages > 1 ? base.nextCursor : page.nextCursor,
    firstPageSize: page.items.length,
    pages: Math.max(1, base.pages),
    failed: false,
    known: remember(base.known, page.items),
  };
}

export type Inbox = {
  items: InboxItem[];
  known: Record<string, InboxItem>;
  // First load of this query.
  loading: boolean;
  // Showing the previous query's items while the new one loads.
  stale: boolean;
  failed: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  moreFailed: boolean;
  loadMore: () => void;
  retry: () => void;
  // The chat was read on this screen; clear its count without waiting.
  markRead: (conversationId: string) => void;
  refresh: () => void;
};

// The staff inbox for a search and filter, refetched on live events.
export function useInbox(query: InboxQuery, subscribe: StreamSubscribe): Inbox {
  const key = inboxUrl(query);
  const [state, setState] = useState<InboxState>(INITIAL);
  const current = useRef({ key, query });

  const refresher = useRefresher(async () => {
    const { key: requested, query: asked } = current.current;
    try {
      const page = await fetchInbox(asked);
      // A newer search started meanwhile; its own fetch follows.
      if (current.current.key !== requested) return;
      setState((previous) => withFirstPage(previous, requested, page));
    } catch {
      if (current.current.key !== requested) return;
      setState((previous) => ({ ...previous, failed: true }));
    }
  }, 500);

  useEffect(() => {
    current.current = { key, query };
  });
  // The key captures every field of the query.
  useEffect(() => {
    void refresher.run();
  }, [key, refresher]);

  useStreamListener(subscribe, {
    onEvent: (event) => {
      if (event.type !== "broadcast") refresher.schedule();
    },
    onOpen: () => refresher.schedule(),
  });

  async function loadMore() {
    const requested = current.current.key;
    if (state.key !== requested || !state.nextCursor || state.loadingMore) {
      return;
    }
    setState((previous) => ({
      ...previous,
      loadingMore: true,
      moreFailed: false,
    }));
    try {
      const page = await fetchInbox(current.current.query, state.nextCursor);
      if (current.current.key !== requested) return;
      setState((previous) => {
        const shown = new Set(
          previous.items.map((item) => item.conversationId),
        );
        return {
          ...previous,
          items: [
            ...previous.items,
            ...page.items.filter((item) => !shown.has(item.conversationId)),
          ],
          nextCursor: page.nextCursor,
          pages: previous.pages + 1,
          loadingMore: false,
          known: remember(previous.known, page.items),
        };
      });
    } catch {
      setState((previous) => ({
        ...previous,
        loadingMore: false,
        moreFailed: true,
      }));
    }
  }

  function markRead(conversationId: string) {
    const clear = (item: InboxItem) =>
      item.conversationId === conversationId ? { ...item, unread: 0 } : item;
    setState((previous) => {
      const known = previous.known[conversationId];
      return {
        ...previous,
        items: previous.items.map(clear),
        known: known
          ? { ...previous.known, [conversationId]: clear(known) }
          : previous.known,
      };
    });
  }

  const ready = state.key !== null;
  return {
    items: state.items,
    known: state.known,
    loading: !ready && !state.failed,
    stale: ready && state.key !== key,
    failed: state.failed,
    hasMore: state.key === key && state.nextCursor !== null,
    loadingMore: state.loadingMore,
    moreFailed: state.moreFailed,
    loadMore: () => void loadMore(),
    retry: () => void refresher.run(),
    markRead,
    refresh: () => refresher.schedule(),
  };
}
