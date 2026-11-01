"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export type ChatTab<K extends string> = {
  key: K;
  label: string;
  unread: number;
  // Screen reader text for the count, e.g. "2 unread messages".
  unreadLabel: string;
};

export const chatTabId = (idBase: string, key: string) =>
  `${idBase}-tab-${key}`;
export const chatPanelId = (idBase: string, key: string) =>
  `${idBase}-panel-${key}`;

// Tabs for the chats on one screen, each with its unread count. Like
// SegmentTabs, but the count only shows when something is unread, and each
// chat has its own panel (rendered by the caller with chatPanelId), so a chat
// keeps its place and unsent text while another tab is open. Arrow keys,
// Home and End move between tabs.
export function ChatTabs<K extends string>({
  tabs,
  value,
  onChange,
  label,
  idBase,
}: {
  tabs: readonly ChatTab<K>[];
  value: K;
  onChange: (key: K) => void;
  label: string;
  idBase: string;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.key === value),
  );

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = tabs.length - 1;
    const next =
      event.key === "ArrowRight"
        ? activeIndex === last
          ? 0
          : activeIndex + 1
        : event.key === "ArrowLeft"
          ? activeIndex === 0
            ? last
            : activeIndex - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    onChange(tabs[next].key);
    buttons.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="flex border-b border-divider px-2"
    >
      {tabs.map((tab, index) => {
        const selected = tab.key === value;
        return (
          <button
            key={tab.key}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            type="button"
            role="tab"
            id={chatTabId(idBase, tab.key)}
            aria-selected={selected}
            aria-controls={chatPanelId(idBase, tab.key)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.key)}
            className={cn(
              "-mb-px flex h-12 flex-1 items-center justify-center gap-2 border-b-2 px-3 text-base font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
              selected
                ? "border-brand font-semibold text-brand"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.unread > 0 && (
              <>
                <span
                  aria-hidden
                  className="min-w-6 rounded-full bg-brand px-1.5 py-0.5 text-center text-xs font-semibold text-white tabular-nums"
                >
                  {tab.unread > 99 ? "99+" : tab.unread}
                </span>
                <span className="sr-only">, {tab.unreadLabel}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
