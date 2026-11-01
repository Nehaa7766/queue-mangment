"use client";

import {
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type {
  MessageSender,
  MessagingEvent,
} from "@/features/messaging/contracts";
import {
  ConversationController,
  INITIAL_SNAPSHOT,
  type ConversationConfig,
  type ConversationSnapshot,
  type SendResult,
} from "./conversation";
import { chatItems, type ChatItem } from "./merge";
import { emptyPending, type PendingMessage } from "./pending-store";
import type { StreamSubscribe } from "./stream";
import { useStreamListener } from "./use-messaging-stream";

function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

export function useDocumentVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === "visible",
    () => true,
  );
}

export type ConversationOptions = ConversationConfig & {
  viewer: MessageSender;
  // The chat is on screen. It is marked read only while the tab is visible.
  active: boolean;
  subscribe: StreamSubscribe;
  // Which live events concern this chat.
  isRelevant: (event: MessagingEvent) => boolean;
  // After this screen marked the chat read, or got a message stored.
  onRead?: () => void;
  onSent?: () => void;
};

export type Conversation = ConversationSnapshot & {
  pending: PendingMessage[];
  items: ChatItem[];
  send: (text: string) => SendResult;
  retry: (clientMessageId: string) => void;
  remove: (clientMessageId: string) => void;
  loadOlder: () => void;
  reload: () => void;
};

const serverSnapshot = () => INITIAL_SNAPSHOT;

// One chat on screen. The URLs and scope are fixed for the hook's lifetime;
// key the component by conversation to switch chats.
export function useConversation(options: ConversationOptions): Conversation {
  const { viewer, active, subscribe } = options;
  const [controller] = useState(
    () =>
      new ConversationController({
        messagesUrl: options.messagesUrl,
        readUrl: options.readUrl,
        scope: options.scope,
      }),
  );

  useEffect(() => {
    controller.start();
    return () => controller.stop();
  }, [controller]);

  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    serverSnapshot,
  );
  const pending = useSyncExternalStore(
    controller.pending.subscribe,
    controller.pending.get,
    emptyPending,
  );

  // Refetch on every relevant hint and every (re)connect.
  useStreamListener(subscribe, {
    onEvent: (event) => {
      if (options.isRelevant(event)) controller.scheduleRefresh();
    },
    onOpen: () => controller.scheduleRefresh(),
  });

  const onSent = useEffectEvent(() => options.onSent?.());
  useEffect(() => controller.onSent(() => onSent()), [controller]);

  // Mark read when the chat is open, the tab is visible and something is
  // unread, including messages that arrive while it stays open.
  const visible = useDocumentVisible();
  const conversationId = snapshot.conversation?.conversationId ?? null;
  const unread = snapshot.conversation?.unread ?? 0;
  const onRead = useEffectEvent(() => options.onRead?.());
  useEffect(() => {
    if (!active || !visible || !conversationId || unread === 0) return;
    void controller.markRead().then((done) => {
      if (done) onRead();
    });
  }, [active, visible, conversationId, unread, controller]);

  const messages = snapshot.history?.messages;
  const items = useMemo(
    () => chatItems(messages ?? [], pending, viewer),
    [messages, pending, viewer],
  );

  return {
    ...snapshot,
    pending,
    items,
    send: controller.send,
    retry: controller.retry,
    remove: controller.remove,
    loadOlder: () => void controller.loadOlder(),
    reload: controller.reload,
  };
}
