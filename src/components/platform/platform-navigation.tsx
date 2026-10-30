"use client";

import { EllipsisIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/layout/brand-mark";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { PLATFORM_NAV, isPlatformNavActive } from "./platform-nav";
import type { PlatformUser } from "./platform-session";

const FOCUS = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const ALL_ITEMS = PLATFORM_NAV.flatMap((group) => group.items);

// Desktop (lg+): 236px white sidebar with grouped sections.
export function PlatformSidebar({
  user,
  accountActions,
}: {
  user: PlatformUser;
  accountActions: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[236px] flex-col border-r border-border bg-card lg:flex">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <BrandMark />
        <div className="leading-tight">
          <p className="font-display font-bold">QueueCare</p>
          <p className="text-xs text-muted-foreground">Platform admin</p>
        </div>
      </div>
      <nav
        aria-label="Main"
        className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-2"
      >
        {PLATFORM_NAV.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            <p className="px-3 pb-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              {group.label}
            </p>
            {group.items.map((item) => {
              const active = isPlatformNavActive(item, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-10 items-center gap-3 rounded-btn px-3 text-sm font-medium transition-colors",
                    FOCUS,
                    active
                      ? "bg-slate text-white"
                      : "text-foreground hover:bg-cream",
                  )}
                >
                  <item.icon className="size-[18px]" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="flex flex-col gap-2 border-t border-border p-3">
        <div className="px-1 leading-tight">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        {accountActions}
      </div>
    </aside>
  );
}

// Tablet (md): 72px slate icon rail; the active icon sits on cream.
export function PlatformIconRail() {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[72px] flex-col items-center gap-2 bg-slate py-4 md:flex lg:hidden">
      <BrandMark className="mb-3 bg-slate-hover" />
      <nav aria-label="Main" className="flex flex-col items-center gap-2">
        {ALL_ITEMS.map((item) => {
          const active = isPlatformNavActive(item, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              title={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex size-12 items-center justify-center rounded-btn transition-colors",
                FOCUS,
                active
                  ? "bg-cream text-slate"
                  : "text-slate-muted hover:bg-slate-hover hover:text-white",
              )}
            >
              <item.icon className="size-5" aria-hidden />
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

// Phone (below md): slate top bar.
export function PlatformTopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2.5 bg-slate px-4 text-white md:hidden">
      <BrandMark className="size-8 bg-slate-hover" />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="font-display text-sm font-bold">QueueCare</p>
        <p className="truncate text-xs text-slate-muted">Platform admin</p>
      </div>
    </header>
  );
}

// Phone (below md): four tabs plus "More" for the rest and sign-out.
export function PlatformBottomTabs({
  user,
  accountActions,
}: {
  user: PlatformUser;
  accountActions: ReactNode;
}) {
  const pathname = usePathname();
  const tabs = ALL_ITEMS.filter((item) => item.tab);
  const more = ALL_ITEMS.filter((item) => !item.tab);
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {tabs.map((item) => {
        const active = isPlatformNavActive(item, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
              FOCUS,
              active ? "text-slate" : "text-muted-foreground",
            )}
          >
            <item.icon
              className={cn("size-5", active && "stroke-[2.5]")}
              aria-hidden
            />
            {item.shortLabel ?? item.label}
          </Link>
        );
      })}
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="More"
          className={cn(
            "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground",
            FOCUS,
          )}
        >
          <EllipsisIcon className="size-5" aria-hidden />
          More
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <span className="block text-sm font-semibold text-foreground">
                {user.name}
              </span>
              <span className="block text-xs font-normal">{user.email}</span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {more.map((item) => (
              <DropdownMenuItem
                key={item.href}
                render={<Link href={item.href} />}
                className="min-h-11"
              >
                <item.icon aria-hidden />
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <div className="p-1">{accountActions}</div>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
