"use client";

import { LockIcon, SearchIcon } from "lucide-react";
import type { MouseEvent } from "react";
import { NativeSelect } from "@/components/admin/admin-ui";
import { TokenBadge } from "@/components/dashboard/list-row";
import { displayName } from "@/components/queue/token-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CHANNELS,
  INBOX_FILTERS,
  type Channel,
  type InboxFilter,
  type InboxItem,
} from "@/features/messaging/contracts";
import { cn } from "@/lib/utils";
import { ConnectionStatus } from "./connection-status";
import {
  CHANNEL_LABELS,
  formatInboxTime,
  INBOX_FILTER_LABELS,
  inboxPreview,
} from "./staff-format";
import type { StreamSnapshot } from "./stream";
import type { Inbox } from "./use-inbox";

const FOCUS =
  "outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset";

export const inboxItemId = (conversationId: string) =>
  `inbox-item-${conversationId}`;

// Left column of the Messages page: search, filters and the list of chats,
// newest activity first.
export function StaffInbox({
  inbox,
  filter,
  onFilterChange,
  channel,
  onChannelChange,
  showChannelFilter,
  search,
  onSearchChange,
  selectedId,
  hrefFor,
  onSelect,
  stream,
  timezone,
  now,
}: {
  inbox: Inbox;
  filter: InboxFilter;
  onFilterChange: (filter: InboxFilter) => void;
  channel: Channel | null;
  onChannelChange: (channel: Channel | null) => void;
  // Reception and clinic admins also answer doctor chats as the fallback.
  showChannelFilter: boolean;
  search: string;
  onSearchChange: (search: string) => void;
  selectedId: string | null;
  hrefFor: (conversationId: string) => string;
  onSelect: (conversationId: string) => void;
  stream: StreamSnapshot;
  timezone: string;
  now: number;
}) {
  const searching = search.trim().length > 0;

  function handleClick(event: MouseEvent<HTMLAnchorElement>, id: string) {
    // Let the browser open new tabs and windows.
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    onSelect(id);
  }

  return (
    <>
      <header className="flex flex-col gap-3 border-b border-divider px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="inbox-title" className="text-[15px] font-semibold">
            Chats
          </h2>
          <ConnectionStatus snapshot={stream} />
        </div>
        <form
          role="search"
          method="post"
          onSubmit={(event) => event.preventDefault()}
          className="relative"
        >
          <label htmlFor="inbox-search" className="sr-only">
            Search chats
          </label>
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="inbox-search"
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Token or patient name"
            autoComplete="off"
            className="h-10 rounded-btn pl-9"
          />
        </form>
        <div
          role="group"
          aria-label="Show"
          className="grid grid-cols-4 gap-1 rounded-btn bg-muted p-1"
        >
          {INBOX_FILTERS.map((key) => {
            const active = key === filter;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => onFilterChange(key)}
                className={cn(
                  "h-10 rounded-md text-xs font-medium transition-colors sm:h-8",
                  FOCUS,
                  active
                    ? "bg-card font-semibold text-foreground shadow-card"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {INBOX_FILTER_LABELS[key]}
              </button>
            );
          })}
        </div>
        {showChannelFilter && (
          <div className="flex items-center gap-2">
            <label
              htmlFor="inbox-channel"
              className="shrink-0 text-xs font-medium text-muted-foreground"
            >
              Chat type
            </label>
            <NativeSelect
              id="inbox-channel"
              value={channel ?? ""}
              onChange={(event) =>
                onChannelChange((event.target.value || null) as Channel | null)
              }
              className="h-10 sm:h-9"
            >
              <option value="">All chats</option>
              {CHANNELS.map((key) => (
                <option key={key} value={key}>
                  {key === "DOCTOR"
                    ? "Doctor chats (no doctor available)"
                    : CHANNEL_LABELS[key]}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
      </header>

      <div
        aria-busy={inbox.loading || inbox.stale}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto",
          inbox.stale && "opacity-60",
        )}
      >
        {inbox.loading ? (
          <InboxSkeleton />
        ) : inbox.failed && inbox.items.length === 0 ? (
          <div
            role="alert"
            className="flex flex-col items-center gap-3 px-4 py-8 text-center text-sm"
          >
            <p>Couldn&apos;t load chats.</p>
            <Button
              variant="outline"
              className="h-10 rounded-btn px-4"
              onClick={inbox.retry}
            >
              Try again
            </Button>
          </div>
        ) : inbox.items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {searching
              ? "No chats match this search."
              : filter === "unread"
                ? "Nothing unread."
                : filter === "closed"
                  ? "No closed chats."
                  : showChannelFilter
                    ? "No chats yet. They appear when a patient writes, or when you message one."
                    : "No chats yet. They appear when one of your patients writes."}
          </p>
        ) : (
          <ul aria-label="Chats" className="divide-y divide-divider">
            {inbox.items.map((item) => (
              <InboxRow
                key={item.conversationId}
                item={item}
                selected={item.conversationId === selectedId}
                href={hrefFor(item.conversationId)}
                onClick={(event) => handleClick(event, item.conversationId)}
                showChannel={showChannelFilter}
                time={
                  item.lastMessage
                    ? formatInboxTime(item.lastMessage.createdAt, timezone, now)
                    : null
                }
              />
            ))}
          </ul>
        )}
        {inbox.hasMore && (
          <div className="flex flex-col items-center gap-1 px-4 py-4">
            <Button
              variant="outline"
              className="h-10 rounded-btn px-4"
              disabled={inbox.loadingMore}
              onClick={inbox.loadMore}
            >
              {inbox.loadingMore ? "Loading…" : "Load more chats"}
            </Button>
            {inbox.moreFailed && (
              <p role="alert" className="text-xs text-destructive">
                Couldn&apos;t load more chats.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function InboxRow({
  item,
  selected,
  href,
  onClick,
  showChannel,
  time,
}: {
  item: InboxItem;
  selected: boolean;
  href: string;
  onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  showChannel: boolean;
  time: string | null;
}) {
  const unread = item.unread > 0;
  return (
    <li>
      <a
        id={inboxItemId(item.conversationId)}
        href={href}
        onClick={onClick}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "flex gap-3 px-4 py-3 transition-colors",
          FOCUS,
          selected ? "bg-brand-tint" : "hover:bg-accent",
        )}
      >
        <TokenBadge
          label={item.token.label}
          tone={item.closed ? "muted" : "brand"}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-semibold">
              {displayName(item.token.patientName)}
            </span>
            {time && (
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {time}
              </span>
            )}
          </span>
          <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <span className="truncate">
              {item.token.serviceName}
              {showChannel && ` · ${CHANNEL_LABELS[item.channel]}`}
            </span>
            {item.closed && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-status-off px-1.5 font-semibold text-status-off-foreground">
                <LockIcon aria-hidden className="size-3" />
                Closed
              </span>
            )}
          </span>
          <span className="flex items-center gap-2">
            <span
              className={cn(
                "truncate text-sm",
                unread
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {inboxPreview(item)}
            </span>
            {unread && (
              <span className="ml-auto shrink-0 rounded-full bg-brand px-1.5 text-center text-[11px] leading-5 font-semibold text-white tabular-nums">
                <span aria-hidden>
                  {item.unread > 99 ? "99+" : item.unread}
                </span>
                <span className="sr-only">{item.unread} unread</span>
              </span>
            )}
          </span>
        </span>
      </a>
    </li>
  );
}

function InboxSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="flex gap-3">
          <Skeleton className="h-10 w-12 rounded-btn" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading chats…</span>
    </div>
  );
}
