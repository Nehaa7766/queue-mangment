"use client";

import { ChevronDownIcon, CircleUserIcon, LifeBuoyIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { useStaffMessaging } from "@/components/messaging/staff-messaging";
import { FOCUS } from "@/components/shell/app-sidebar";
import {
  badgeText,
  withNavBadges,
  type NavGroup,
} from "@/components/shell/types";
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
import {
  isActive,
  MESSAGES_HREF,
  navForRole,
  ROLE_LABELS,
  WALK_IN_HREF,
} from "./staff-nav";
import { useStaff } from "./staff-provider";

// The signed-in member's menu, with the unread chat count on Messages.
export function useStaffNavGroups(): NavGroup[] {
  const { role } = useStaff();
  const { unread } = useStaffMessaging();
  return useMemo(
    () =>
      withNavBadges(navForRole(role), {
        [MESSAGES_HREF[role]]: unread
          ? {
              count: unread,
              label: unread === 1 ? "1 unread chat" : `${unread} unread chats`,
            }
          : undefined,
      }),
    [role, unread],
  );
}

// Phone (below md): bottom tabs with a raised mocha Walk-in button.
export function BottomTabs({ accountActions }: { accountActions?: ReactNode }) {
  const groups = useStaffNavGroups();
  const pathname = usePathname();
  const items = groups
    .flatMap((group) => group.items)
    .filter((item) => item.tab);
  const hasWalkIn = groups.some((group) =>
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
          active ? "text-brand" : "text-muted-foreground",
        )}
      >
        <span className="relative">
          <item.icon
            className={cn("size-5", active && "stroke-[2.5]")}
            aria-hidden
          />
          {item.badge && item.badge.count > 0 && (
            <span
              aria-hidden
              className="absolute -top-1.5 left-3 min-w-5 rounded-full border-2 border-card bg-brand px-1 text-center text-[10px] leading-4 font-semibold text-white tabular-nums"
            >
              {badgeText(item.badge.count)}
            </span>
          )}
        </span>
        {item.shortLabel ?? item.label}
        {item.badge && item.badge.count > 0 && (
          <span className="sr-only">, {item.badge.label}</span>
        )}
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
              "-mt-5 flex size-14 items-center justify-center rounded-full border-4 border-background bg-brand text-white shadow-card",
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
            : "flex items-center gap-2.5 rounded-full py-1 pr-2 pl-1 text-left hover:bg-accent",
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
              className="flex size-9 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white"
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
            <ChevronDownIcon
              className="hidden size-4 text-muted-foreground xl:block"
              aria-hidden
            />
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
