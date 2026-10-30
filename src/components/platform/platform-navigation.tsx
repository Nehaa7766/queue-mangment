"use client";

import { ChevronDownIcon, EllipsisIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { FOCUS } from "@/components/shell/app-sidebar";
import { isActive } from "@/components/shell/types";
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
import { PLATFORM_NAV } from "./platform-nav";
import type { PlatformUser } from "./platform-session";

const ALL_ITEMS = PLATFORM_NAV.flatMap((group) => group.items);

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// Top bar account menu: name, email and sign-out.
export function PlatformAccountMenu({
  user,
  accountActions,
}: {
  user: PlatformUser;
  accountActions: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2.5 rounded-full py-1 pr-2 pl-1 text-left hover:bg-accent",
          FOCUS,
        )}
      >
        <span
          aria-hidden
          className="flex size-9 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white"
        >
          {initialsOf(user.name)}
        </span>
        {/* Screen-reader only below xl, so the button always has a name. */}
        <span className="sr-only leading-tight xl:not-sr-only xl:block">
          <span className="block text-sm font-semibold">{user.name}</span>
          <span className="block text-xs text-muted-foreground">
            Super admin
          </span>
        </span>
        <ChevronDownIcon
          className="hidden size-4 text-muted-foreground xl:block"
          aria-hidden
        />
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
        <div className="p-1">{accountActions}</div>
      </DropdownMenuContent>
    </DropdownMenu>
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
