"use client";

import {
  ArrowLeftIcon,
  ConciergeBellIcon,
  ShieldAlertIcon,
  StethoscopeIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import {
  ChatSettingsProvider,
  type ChatSettings,
} from "@/components/messaging/chat-context";
import { ChatPanel } from "@/components/messaging/chat-panel";
import { ChatEmpty, ChatSkeleton } from "@/components/messaging/chat-states";
import {
  ChatTabs,
  chatPanelId,
  chatTabId,
} from "@/components/messaging/chat-tabs";
import { ConnectionStatus } from "@/components/messaging/connection-status";
import type { ChatItem } from "@/components/messaging/merge";
import type {
  StreamSnapshot,
  StreamSubscribe,
} from "@/components/messaging/stream";
import { useConversation } from "@/components/messaging/use-conversation";
import {
  useMessagingStream,
  type MessagingStreamHandle,
} from "@/components/messaging/use-messaging-stream";
import {
  usePatientSummary,
  type PatientSummaryState,
} from "@/components/messaging/use-patient-summary";
import { Button } from "@/components/ui/button";
import {
  CHANNELS,
  MESSAGING_API,
  type Channel,
  type DoctorRouting,
} from "@/features/messaging/contracts";
import { messages } from "./messages";

const t = messages.messaging;

const localTime = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});
const localDayTime = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});

const PATIENT_CHAT: ChatSettings = {
  copy: messages.chat,
  // Patients are at the clinic, so their own clock is the clinic's.
  formatTime: (iso) => {
    const date = new Date(iso);
    return date.toDateString() === new Date().toDateString()
      ? localTime.format(date)
      : localDayTime.format(date);
  },
  variant: "patient",
};

export function routingText(routing: DoctorRouting): string {
  switch (routing.kind) {
    case "ASSIGNED_DOCTOR":
      return t.routing.assignedDoctor(routing.doctorName);
    case "SERVICE_DOCTORS":
      return t.routing.serviceDoctors(routing.serviceName);
    case "RECEPTION_FALLBACK":
      return t.routing.receptionFallback;
  }
}

// Who the patient is talking to, for the chat header.
export function chatTitle(
  channel: Channel,
  routing: DoctorRouting | null,
): string {
  if (channel === "RECEPTION" || !routing) return t.tabs[channel];
  switch (routing.kind) {
    case "ASSIGNED_DOCTOR":
      return t.chatTitle.assignedDoctor(routing.doctorName);
    case "SERVICE_DOCTORS":
      return t.chatTitle.serviceDoctors(routing.serviceName);
    case "RECEPTION_FALLBACK":
      return t.chatTitle.receptionFallback;
  }
}

export const CHANNEL_ICONS = {
  RECEPTION: ConciergeBellIcon,
  DOCTOR: StethoscopeIcon,
} as const;

function senderOf(item: ChatItem): string {
  if (item.mine) return messages.chat.you;
  return (item.kind === "message" && item.message.senderName) || t.clinic;
}

export function channelParam(channel: Channel): string {
  return channel.toLowerCase();
}

// Which chat is showing, and which have been opened (they stay mounted, so
// switching keeps each one's place and unsent text).
export function useChatChannel(
  initial: Channel,
  onChange?: (channel: Channel) => void,
) {
  const [channel, setChannel] = useState<Channel>(initial);
  const [opened, setOpened] = useState<readonly Channel[]>([initial]);
  function select(next: Channel) {
    setChannel(next);
    setOpened((list) => (list.includes(next) ? list : [...list, next]));
    onChange?.(next);
  }
  return { channel, opened, select };
}

export type ChatChannelState = ReturnType<typeof useChatChannel>;
export type PatientSummaryHandle = PatientSummaryState & {
  refresh: () => void;
  retry: () => void;
};

// Reception / Doctor tabs and the open chat, below a header the caller
// draws: the full-screen chat on phones, or the chat beside the token on
// desktop. The private token link is the patient's only credential: it goes
// to the API in the URL, as the page itself does, and is never stored.
export function PatientChats({
  publicTokenId,
  chats,
  stream,
  summary,
}: {
  publicTokenId: string;
  chats: ChatChannelState;
  stream: MessagingStreamHandle;
  summary: PatientSummaryHandle;
}) {
  const idBase = useId();
  const data = summary.data;

  if (data === null) {
    return summary.failed ? (
      <div
        role="alert"
        className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-8 text-center"
      >
        <p className="text-base">{t.summaryFailed}</p>
        <Button
          variant="outline"
          className="h-12 rounded-btn px-5"
          onClick={summary.retry}
        >
          {t.retry}
        </Button>
      </div>
    ) : (
      <ChatSkeleton label={t.loading} className="flex-1" />
    );
  }

  return (
    <ChatSettingsProvider value={PATIENT_CHAT}>
      <div className="shrink-0">
        <ChatTabs
          label={t.tabsLabel}
          idBase={idBase}
          value={chats.channel}
          onChange={chats.select}
          tabs={CHANNELS.map((key) => {
            const unread =
              key === "RECEPTION" ? data.reception.unread : data.doctor.unread;
            return {
              key,
              label: t.tabs[key],
              unread,
              unreadLabel: t.unread(unread),
            };
          })}
        />
      </div>
      {CHANNELS.map((key) => (
        <div
          key={key}
          role="tabpanel"
          id={chatPanelId(idBase, key)}
          aria-labelledby={chatTabId(idBase, key)}
          hidden={chats.channel !== key}
          className="flex min-h-0 flex-1 flex-col"
        >
          {chats.opened.includes(key) && (
            <PatientChannelChat
              publicTokenId={publicTokenId}
              channel={key}
              active={chats.channel === key}
              subscribe={stream.subscribe}
              stream={stream.snapshot}
              routing={key === "DOCTOR" ? data.doctor.routing : null}
              onChange={summary.refresh}
            />
          )}
        </div>
      ))}
    </ChatSettingsProvider>
  );
}

// Who the open chat is with: icon, name and a second line, for both headers.
export function ChatWho({
  channel,
  routing,
  subtitle,
  level,
}: {
  channel: Channel;
  routing: DoctorRouting | null;
  subtitle: string;
  level: 1 | 2;
}) {
  const Icon = CHANNEL_ICONS[channel];
  const Heading = level === 1 ? "h1" : "h2";
  return (
    <>
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand"
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <Heading className="truncate text-base leading-tight font-semibold">
          {chatTitle(channel, routing)}
        </Heading>
        <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </>
  );
}

// The phone's chat screen (/token/<id>/messages): full height like a
// messaging app, with the way back to the token, who they're talking to,
// the switch, the history and the composer pinned at the bottom.
export function PatientChatScreen({
  publicTokenId,
  clinicName,
  tokenLabel,
  initialChannel,
}: {
  publicTokenId: string;
  clinicName: string;
  tokenLabel: string;
  initialChannel: Channel;
}) {
  const router = useRouter();
  const stream = useMessagingStream(MESSAGING_API.patientEvents(publicTokenId));
  const summary = usePatientSummary(publicTokenId, stream.subscribe);
  // In the URL, so refresh and the back button keep the chat.
  const chats = useChatChannel(initialChannel, (next) =>
    router.replace(`?with=${channelParam(next)}`, { scroll: false }),
  );

  return (
    <div className="mx-auto flex h-full w-full max-w-md min-w-0 flex-col bg-card md:my-4 md:h-[calc(100%-2rem)] md:overflow-hidden md:rounded-card md:border md:border-border md:shadow-card">
      <header className="flex shrink-0 items-center gap-2 border-b border-divider px-2 py-2.5">
        <Link
          href={`/token/${publicTokenId}`}
          className="flex size-11 shrink-0 items-center justify-center rounded-btn text-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeftIcon aria-hidden className="size-5" />
          <span className="sr-only">{t.back}</span>
        </Link>
        <ChatWho
          channel={chats.channel}
          routing={summary.data?.doctor.routing ?? null}
          subtitle={t.tokenLine(clinicName, tokenLabel)}
          level={1}
        />
        <ConnectionStatus
          snapshot={stream.snapshot}
          className="mr-2 shrink-0"
        />
      </header>
      <PatientChats
        publicTokenId={publicTokenId}
        chats={chats}
        stream={stream}
        summary={summary}
      />
    </div>
  );
}

function PatientChannelChat({
  publicTokenId,
  channel,
  active,
  subscribe,
  stream,
  routing,
  onChange,
}: {
  publicTokenId: string;
  channel: Channel;
  active: boolean;
  subscribe: StreamSubscribe;
  stream: StreamSnapshot;
  routing: DoctorRouting | null;
  // Unread counts or the chat changed; refresh the tabs.
  onChange: () => void;
}) {
  const chat = useConversation({
    messagesUrl: MESSAGING_API.patientMessages(publicTokenId, channel),
    readUrl: MESSAGING_API.patientRead(publicTokenId, channel),
    scope: `patient:${publicTokenId}:${channel}`,
    viewer: "PATIENT",
    active,
    subscribe,
    isRelevant: (event) =>
      event.type !== "broadcast" && event.channel === channel,
    onRead: onChange,
    onSent: onChange,
  });
  // The chat's own state is the freshest; the summary fills in before it loads.
  const answering = chat.conversation?.routing ?? routing;

  return (
    <section
      aria-label={t.title}
      className="flex min-h-0 flex-1 flex-col bg-card"
    >
      <div className="flex shrink-0 flex-col gap-1 border-b border-divider bg-muted/60 px-4 py-2 text-sm text-muted-foreground">
        {channel === "DOCTOR" && answering && (
          <p className="flex items-center gap-2">
            <StethoscopeIcon
              aria-hidden
              className="size-4 shrink-0 text-brand"
            />
            {routingText(answering)}
          </p>
        )}
        <p className="flex items-center gap-2">
          <ShieldAlertIcon aria-hidden className="size-4 shrink-0 text-brand" />
          {t.emergency}
        </p>
      </div>
      <ChatPanel
        className="flex-1 pb-[env(safe-area-inset-bottom)]"
        chat={chat}
        stream={stream}
        senderOf={senderOf}
        loadingLabel={t.loading}
        closedNote={t.closed}
        empty={
          <ChatEmpty
            title={t.empty[channel].title}
            body={t.empty[channel].body}
          />
        }
      />
    </section>
  );
}
