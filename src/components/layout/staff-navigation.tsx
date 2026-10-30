"use client";

import { BellIcon, CircleUserIcon, LifeBuoyIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
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
import { BrandMark } from "./brand-mark";
import {
  isActive,
  ACTIVITY_HREF,
  navForRole,
  PANEL_NAMES,
  ROLE_LABELS,
  WALK_IN_HREF,
} from "./staff-nav";
import { useStaff } from "./staff-provider";

const FOCUS = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

// Desktop (lg+): 236px white sidebar with grouped sections.
export function Sidebar({ accountActions }: { accountActions?: ReactNode }) {
  const { role } = useStaff();
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[236px] flex-col border-r border-border bg-card lg:flex">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <BrandMark />
        <div className="leading-tight">
          <p className="font-display font-bold">QueueCare</p>
          <p className="text-xs text-muted-foreground">{PANEL_NAMES[role]}</p>
        </div>
      </div>
      <nav
        aria-label="Main"
        className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-2"
      >
        {navForRole(role).map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            <p className="px-3 pb-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              {group.label}
            </p>
            {group.items.map((item) => {
              const active = isActive(item, pathname);
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
      {accountActions && (
        <div className="border-t border-border p-3">{accountActions}</div>
      )}
    </aside>
  );
}

// Tablet (md): 72px slate icon rail; the active icon sits on cream.
export function IconRail() {
  const { role } = useStaff();
  const pathname = usePathname();
  const items = navForRole(role).flatMap((group) => group.items);
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[72px] flex-col items-center gap-2 bg-slate py-4 md:flex lg:hidden">
      <BrandMark className="mb-3 bg-slate-hover" />
      <nav aria-label="Main" className="flex flex-col items-center gap-2">
        {items.map((item) => {
          const active = isActive(item, pathname);
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
export function MobileTopBar() {
  const { clinic, role } = useStaff();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2.5 bg-slate px-4 text-white md:hidden">
      <BrandMark className="size-8 bg-slate-hover" />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="font-display text-sm font-bold">QueueCare</p>
        <p className="truncate text-xs text-slate-muted">{clinic.name}</p>
      </div>
      <Link
        href={ACTIVITY_HREF[role]}
        aria-label="Recent activity"
        className={cn(
          "flex size-11 items-center justify-center rounded-btn hover:bg-slate-hover",
          FOCUS,
        )}
      >
        <BellIcon className="size-5" aria-hidden />
      </Link>
    </header>
  );
}

// Phone (below md): bottom tabs with a raised terracotta Walk-in button.
export function BottomTabs({ accountActions }: { accountActions?: ReactNode }) {
  const { role } = useStaff();
  const pathname = usePathname();
  const items = navForRole(role)
    .flatMap((group) => group.items)
    .filter((item) => item.tab);
  const hasWalkIn = navForRole(role).some((group) =>
    group.items.some((item) => item.href === WALK_IN_HREF),
  );
  // Walk-in sits in the middle slot.
  const middle = Math.ceil(items.length / 2);

  const tab = (item: (typeof items)[number]) => {
    const active = isActive(item, pathname);
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
  };

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {items.slice(0, middle).map(tab)}
      {hasWalkIn && (
        <div className="flex flex-1 items-start justify-center">
          <Link
            href={WALK_IN_HREF}
            aria-label="Register walk-in"
            className={cn(
              "-mt-5 flex size-14 items-center justify-center rounded-full border-4 border-background bg-terracotta text-charcoal",
              FOCUS,
            )}
          >
            <span aria-hidden className="text-2xl leading-none font-bold">
              +
            </span>
          </Link>
        </div>
      )}
      {items.slice(middle).map(tab)}
      <AccountMenu accountActions={accountActions} variant="tab" />
    </nav>
  );
}

// Name, role and clinic, plus the sign-out slot.
export function AccountMenu({
  accountActions,
  variant,
}: {
  accountActions?: ReactNode;
  variant: "tab" | "header";
}) {
  const { user, role, clinic } = useStaff();
  const initials = user.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          variant === "tab"
            ? "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground"
            : "flex items-center gap-2.5 rounded-btn px-1.5 py-1 text-left hover:bg-accent",
          FOCUS,
        )}
      >
        {variant === "tab" ? (
          <>
            <CircleUserIcon className="size-5" aria-hidden />
            Profile
            <span className="sr-only">, {user.name}</span>
          </>
        ) : (
          <>
            <span
              aria-hidden
              className="flex size-9 items-center justify-center rounded-full bg-slate text-xs font-semibold text-white"
            >
              {initials}
            </span>
            {/* Screen-reader only below xl, so the button always has a name. */}
            <span className="sr-only leading-tight xl:not-sr-only xl:block">
              <span className="block text-sm font-semibold">{user.name}</span>
              <span className="block text-xs text-muted-foreground">
                {ROLE_LABELS[role]}
              </span>
            </span>
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block text-sm font-semibold text-foreground">
              {user.name}
            </span>
            <span className="block text-xs font-normal">
              {ROLE_LABELS[role]} · {clinic.name}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            render={<Link href="/support" />}
            className="min-h-11"
          >
            <LifeBuoyIcon aria-hidden />
            Help and support
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {accountActions && (
          <>
            <DropdownMenuSeparator />
            <div className="p-1">{accountActions}</div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
