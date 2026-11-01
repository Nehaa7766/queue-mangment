"use client";

import {
  ChevronRightIcon,
  MessageCircleIcon,
  ShieldAlertIcon,
} from "lucide-react";
import Link from "next/link";
import {
  createContext,
  use,
  useId,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { ConnectionStatus } from "@/components/messaging/connection-status";
import {
  useMessagingStream,
  type MessagingStreamHandle,
} from "@/components/messaging/use-messaging-stream";
import { usePatientSummary } from "@/components/messaging/use-patient-summary";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CHANNELS,
  MESSAGING_API,
  type Channel,
  type PatientMessagingSummary,
} from "@/features/messaging/contracts";
import { cn } from "@/lib/utils";
import { messages } from "./messages";
import {
  CHANNEL_ICONS,
  ChatWho,
  PatientChats,
  channelParam,
  routingText,
  useChatChannel,
  type PatientSummaryHandle,
} from "./patient-chat-screen";

const t = messages.messaging;

// The token page's messaging pieces share one live connection and one
// summary: on phones the top button, the card and the new-message bar; on
// desktop the chat beside the token.
type PatientMessaging = {
  publicTokenId: string;
  stream: MessagingStreamHandle;
  summary: PatientSummaryHandle;
};

const PatientMessagingContext = createContext<PatientMessaging | null>(null);

function usePatientMessaging(): PatientMessaging {
  const value = use(PatientMessagingContext);
  if (!value) throw new Error("Inside <PatientMessagingProvider> only.");
  return value;
}

export function PatientMessagingProvider({
  publicTokenId,
  children,
}: {
  publicTokenId: string;
  children: ReactNode;
}) {
  const stream = useMessagingStream(MESSAGING_API.patientEvents(publicTokenId));
  const summary = usePatientSummary(publicTokenId, stream.subscribe);
  return (
    <PatientMessagingContext value={{ publicTokenId, stream, summary }}>
      {children}
    </PatientMessagingContext>
  );
}

// Same breakpoint as Tailwind's `lg`: the token page shows the chat beside
// the token from here up.
const DESKTOP_QUERY = "(min-width: 1024px)";

function subscribeDesktop(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}

function chatHref(publicTokenId: string, channel: Channel): string {
  return `/token/${publicTokenId}/messages?with=${channelParam(channel)}`;
}

function unreadOf(summary: PatientMessagingSummary, channel: Channel): number {
  return channel === "RECEPTION"
    ? summary.reception.unread
    : summary.doctor.unread;
}

// The chat with something unread (reception first), else null.
function firstUnread(summary: PatientMessagingSummary | null): Channel | null {
  if (!summary) return null;
  return CHANNELS.find((channel) => unreadOf(summary, channel) > 0) ?? null;
}

function UnreadCount({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count === 0) return null;
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-semibold text-white tabular-nums",
        className,
      )}
    >
      <span aria-hidden>{count > 99 ? "99+" : count}</span>
      <span className="sr-only">, {t.unread(count)}</span>
    </span>
  );
}

// Phones: top of the token page, straight to the chats with the unread total.
export function PatientMessagesButton() {
  const { publicTokenId, summary } = usePatientMessaging();
  const data = summary.data;
  const total = data ? data.reception.unread + data.doctor.unread : 0;
  return (
    <Link
      href={chatHref(publicTokenId, firstUnread(data) ?? "RECEPTION")}
      className="relative inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-3.5 text-sm font-semibold text-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden"
    >
      <MessageCircleIcon aria-hidden className="size-4 text-brand" />
      {t.open}
      <UnreadCount count={total} />
    </Link>
  );
}

// Phones: under the ticket, one row per chat with who answers and unread
// counts; each opens the full-screen chat.
export function PatientMessagesCard() {
  const { publicTokenId, summary, stream } = usePatientMessaging();
  const titleId = useId();
  const data = summary.data;

  return (
    <section
      aria-labelledby={titleId}
      className="overflow-hidden rounded-card border border-border bg-card shadow-card lg:hidden"
    >
      <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <h2 id={titleId} className="font-display text-xl font-bold">
            {t.title}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{t.intro}</p>
        </div>
        <ConnectionStatus
          snapshot={stream.snapshot}
          className="mt-1 shrink-0"
        />
      </header>
      <ul className="divide-y divide-divider border-y border-divider">
        {CHANNELS.map((channel) => {
          const Icon = CHANNEL_ICONS[channel];
          const unread = data ? unreadOf(data, channel) : 0;
          const routing = channel === "DOCTOR" ? data?.doctor.routing : null;
          const closed =
            data &&
            (channel === "RECEPTION" ? data.reception : data.doctor).closed;
          return (
            <li key={channel}>
              <Link
                href={chatHref(publicTokenId, channel)}
                className="flex min-h-16 items-center gap-3.5 px-5 py-3 outline-none hover:bg-muted/60 focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
              >
                <span
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand"
                >
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold">
                    {t.tabs[channel]}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {closed
                      ? messages.chat.composer.closedLabel
                      : routing
                        ? routingText(routing)
                        : t.rowHint[channel]}
                  </span>
                </span>
                <UnreadCount count={unread} />
                <ChevronRightIcon
                  aria-hidden
                  className="size-5 shrink-0 text-muted-foreground"
                />
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="flex items-start gap-2.5 px-5 py-3 text-sm text-muted-foreground">
        <ShieldAlertIcon
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-brand"
        />
        {t.emergency}
      </p>
    </section>
  );
}

// Phones: pinned to the bottom while something is unread, so a message from
// the clinic (e.g. "Doctor delayed") is noticed without scrolling.
export function NewMessageBar() {
  const { publicTokenId, summary } = usePatientMessaging();
  const channel = firstUnread(summary.data);
  if (!channel) return null;
  return (
    <div className="lg:hidden">
      {/* Keeps the end of the page clear of the bar. */}
      <div aria-hidden className="h-20" />
      <div className="fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Link
          href={chatHref(publicTokenId, channel)}
          className="mx-auto flex h-14 w-full max-w-md items-center gap-3 rounded-card bg-brand px-4 text-white shadow-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <MessageCircleIcon aria-hidden className="size-5 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-base font-semibold">
            {t.newMessage(t.tabs[channel])}
          </span>
          <span className="shrink-0 text-sm font-semibold underline underline-offset-4">
            {t.view}
          </span>
        </Link>
      </div>
    </div>
  );
}

// Desktop: the chat itself, beside the token, like a messaging app. It is
// only mounted on desktop widths, so a chat hidden on a phone is never
// marked read. Its height leaves room for the top bar and the clinic strip,
// so the composer is in view without scrolling.
export function PatientChatDock({
  clinicName,
  tokenLabel,
}: {
  clinicName: string;
  tokenLabel: string;
}) {
  const desktop = useIsDesktop();
  return (
    <aside
      aria-label={t.title}
      className="hidden lg:sticky lg:top-[5.5rem] lg:flex lg:h-[calc(100dvh-15rem)] lg:min-h-[30rem] lg:flex-col lg:overflow-hidden lg:rounded-card lg:border lg:border-border lg:bg-card lg:shadow-card"
    >
      {desktop ? (
        <DockChats clinicName={clinicName} tokenLabel={tokenLabel} />
      ) : (
        <div aria-busy="true" className="flex flex-1 flex-col gap-3 p-5">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-10 w-full rounded-btn" />
          <Skeleton className="mt-auto h-12 w-full rounded-btn" />
        </div>
      )}
    </aside>
  );
}

function DockChats({
  clinicName,
  tokenLabel,
}: {
  clinicName: string;
  tokenLabel: string;
}) {
  const { publicTokenId, stream, summary } = usePatientMessaging();
  // Open on the chat with something unread.
  const chats = useChatChannel(firstUnread(summary.data) ?? "RECEPTION");
  return (
    <>
      <header className="flex shrink-0 items-center gap-3 border-b border-divider px-5 py-3.5">
        <ChatWho
          channel={chats.channel}
          routing={summary.data?.doctor.routing ?? null}
          subtitle={t.tokenLine(clinicName, tokenLabel)}
          level={2}
        />
        <ConnectionStatus snapshot={stream.snapshot} className="shrink-0" />
      </header>
      <PatientChats
        publicTokenId={publicTokenId}
        chats={chats}
        stream={stream}
        summary={summary}
      />
    </>
  );
}
