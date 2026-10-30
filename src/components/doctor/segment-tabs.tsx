"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SegmentTab<K extends string> = {
  key: K;
  label: string;
  count: number;
};

// Underlined tabs with a count on each, as in the reference dashboards.
// Arrow keys, Home and End move between tabs (WAI-ARIA tabs pattern).
export function SegmentTabs<K extends string>({
  tabs,
  value,
  onChange,
  label,
  idBase,
  children,
}: {
  tabs: readonly SegmentTab<K>[];
  value: K;
  onChange: (key: K) => void;
  label: string;
  idBase: string;
  children: ReactNode;
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
    <div className="flex flex-col">
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex gap-1 overflow-x-auto border-b border-divider px-3"
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
              id={`${idBase}-tab-${tab.key}`}
              aria-selected={selected}
              aria-controls={`${idBase}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.key)}
              className={cn(
                "-mb-px flex h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                selected
                  ? "border-brand font-semibold text-brand"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums",
                  selected
                    ? "bg-brand-tint text-brand"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`${idBase}-panel`}
        aria-labelledby={`${idBase}-tab-${tabs[activeIndex]?.key}`}
        tabIndex={0}
        className="outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {children}
      </div>
    </div>
  );
}
