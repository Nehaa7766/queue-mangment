"use client";

import {
  BellIcon,
  MaximizeIcon,
  MenuIcon,
  MinimizeIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { useSyncExternalStore, type ReactNode } from "react";
import { BrandMark, BrandName } from "@/components/layout/brand-mark";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FOCUS } from "./app-sidebar";
import { useShellInfo, useShellUi } from "./shell-context";

export const ICON_BUTTON = cn(
  "flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
  FOCUS,
);

export type TopBarProps = {
  // The panel's most common action, e.g. registering a walk-in.
  quickAction?: { href: string; label: string };
  search?: { action: string; label: string; placeholder: string };
  activityHref?: string;
  account: ReactNode;
};

function subscribeFullscreen(onChange: () => void): () => void {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}

// Full screen suits a reception desk or a waiting-room screen. Hidden where
// the browser can't do it (for example iPhone Safari), and on the server.
export function FullscreenButton() {
  const supported = useSyncExternalStore(
    subscribeFullscreen,
    () => document.fullscreenEnabled,
    () => false,
  );
  const active = useSyncExternalStore(
    subscribeFullscreen,
    () => document.fullscreenElement !== null,
    () => false,
  );

  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={() =>
        active
          ? void document.exitFullscreen()
          : void document.documentElement.requestFullscreen()
      }
      aria-label={active ? "Exit full screen" : "Full screen"}
      className={cn(ICON_BUTTON, "hidden lg:flex")}
    >
      {active ? (
        <MinimizeIcon className="size-[18px]" aria-hidden />
      ) : (
        <MaximizeIcon className="size-[18px]" aria-hidden />
      )}
    </button>
  );
}

// White bar across the top of every panel (docs/GUI_RULES.md §6).
export function AppTopBar({
  quickAction,
  search,
  activityHref,
  account,
}: TopBarProps) {
  const { homeHref } = useShellInfo();
  const { setDrawerOpen } = useShellUi();

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-card px-3 md:gap-3 md:px-5">
      {/* Below lg only: opens the menu drawer. On desktop the round handle on
          the sidebar's edge collapses and expands it. */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label="Open menu"
        className={cn(ICON_BUTTON, "lg:hidden")}
      >
        <MenuIcon className="size-5" aria-hidden />
      </button>
      <Link
        href={homeHref}
        className={cn("flex items-center gap-2 rounded-btn lg:hidden", FOCUS)}
      >
        <BrandMark className="size-8" />
        <BrandName className="sr-only sm:not-sr-only" />
      </Link>
      {quickAction && (
        <Link
          href={quickAction.href}
          className={cn(
            "hidden h-9 items-center gap-2 rounded-full bg-brand pr-4 pl-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover md:inline-flex",
            FOCUS,
          )}
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-white/20">
            <PlusIcon className="size-4" aria-hidden />
          </span>
          {quickAction.label}
        </Link>
      )}

      <div className="flex-1" />

      {search && (
        <>
          <Form
            action={search.action}
            role="search"
            className="relative hidden lg:block"
          >
            <SearchIcon
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              name="q"
              type="search"
              aria-label={search.label}
              placeholder={search.placeholder}
              className="h-9 w-[260px] rounded-full border-transparent bg-background pl-9 focus-visible:bg-card"
            />
          </Form>
          <Link
            href={search.action}
            aria-label={search.label}
            className={cn(ICON_BUTTON, "lg:hidden")}
          >
            <SearchIcon className="size-[18px]" aria-hidden />
          </Link>
        </>
      )}
      <FullscreenButton />
      {activityHref && (
        <Link
          href={activityHref}
          aria-label="Recent activity"
          className={ICON_BUTTON}
        >
          <BellIcon className="size-[18px]" aria-hidden />
        </Link>
      )}
      <span aria-hidden className="mx-1 hidden h-6 w-px bg-border md:block" />
      {account}
    </header>
  );
}
