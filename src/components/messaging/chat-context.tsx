"use client";

import { createContext, use, type ReactNode } from "react";
import type { SendFailure } from "./pending-store";
import type { StreamStatus } from "./stream";
import type { DeliveryStatus } from "./merge";

// Words and time format for the shared chat pieces. Staff screens use the
// defaults below; the patient screen passes its own from
// src/components/patient/messages.ts, where every patient string lives.
export type ChatCopy = {
  status: Record<DeliveryStatus, string>;
  failure: Record<SendFailure, string>;
  retry: string;
  remove: string;
  loadOlder: string;
  loadingOlder: string;
  olderFailed: string;
  history: string;
  // Who wrote the viewer's own messages, for screen readers.
  you: string;
  announcement: string;
  jumpToLatest: string;
  composer: {
    label: string;
    placeholder: string;
    send: string;
    hint: string;
    tooLong: string;
    counter: (length: number) => string;
    closedLabel: string;
  };
  loadFailed: { title: string; body: string; retry: string };
  unavailable: { title: string; body: string };
  connection: Record<StreamStatus, string>;
  connectionNote: { reconnecting: string; offline: string };
  announce: {
    newMessage: (sender: string, body: string) => string;
    sent: string;
    seen: string;
    failed: string;
  };
};

const count = new Intl.NumberFormat("en-IN");

export const STAFF_CHAT_COPY: ChatCopy = {
  status: {
    sending: "Sending",
    sent: "Sent",
    seen: "Seen",
    failed: "Not sent",
  },
  failure: {
    network: "No connection. It sends when you're back online.",
    server: "The server had a problem. It retries when you're back online.",
    closed: "This chat is closed.",
    "rate-limited": "Too many messages. Wait a minute, then retry.",
    forbidden: "You can no longer write in this chat.",
    rejected: "Check the message and retry.",
  },
  retry: "Retry",
  remove: "Remove",
  loadOlder: "Load older messages",
  loadingOlder: "Loading…",
  olderFailed: "Couldn't load older messages.",
  history: "Message history",
  you: "You",
  announcement: "Announcement",
  jumpToLatest: "New messages",
  composer: {
    label: "Message",
    placeholder: "Write a message…",
    send: "Send",
    hint: "Enter to send · Shift+Enter for a new line",
    tooLong: "Keep it under 1,000 characters.",
    counter: (length) => `${count.format(length)} / 1,000`,
    closedLabel: "Chat closed",
  },
  loadFailed: {
    title: "Couldn't load this chat",
    body: "Check the connection and try again.",
    retry: "Try again",
  },
  unavailable: {
    title: "This chat isn't available",
    body: "It may have been deleted, or the visit has moved to someone else.",
  },
  connection: {
    connecting: "Connecting…",
    live: "Live",
    reconnecting: "Reconnecting…",
    offline: "Offline",
  },
  connectionNote: {
    reconnecting: "Reconnecting. New messages may take a moment to appear.",
    offline: "You're offline. Messages send when you're back online.",
  },
  announce: {
    newMessage: (sender, body) => `New message from ${sender}: ${body}`,
    sent: "Message sent",
    seen: "Message seen",
    failed: "Message not sent",
  },
};

const localTime = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

export type ChatSettings = {
  copy: ChatCopy;
  // "09:05", or with the day for older messages.
  formatTime: (iso: string) => string;
  // Patient screens use 16px text (docs/GUI_RULES.md §3).
  variant: "patient" | "staff";
};

const DEFAULT_SETTINGS: ChatSettings = {
  copy: STAFF_CHAT_COPY,
  formatTime: (iso) => localTime.format(new Date(iso)),
  variant: "staff",
};

const ChatSettingsContext = createContext<ChatSettings>(DEFAULT_SETTINGS);

export function ChatSettingsProvider({
  value,
  children,
}: {
  value: ChatSettings;
  children: ReactNode;
}) {
  return <ChatSettingsContext value={value}>{children}</ChatSettingsContext>;
}

export function useChatSettings(): ChatSettings {
  return use(ChatSettingsContext);
}
