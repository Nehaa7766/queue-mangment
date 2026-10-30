"use client";

import { BellIcon, SearchIcon } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import type { ReactNode } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ACTIVITY_HREF } from "./staff-nav";
import { AccountMenu } from "./staff-navigation";
import { useStaff } from "./staff-provider";

const ICON_BUTTON =
  "flex size-10 items-center justify-center rounded-btn border border-border bg-card outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50";

// Page title with a status line on the left; search, activity and account on
// the right from md up (docs/PLAN.md §12.6). Search looks up today's tokens.
export function PageHeader({
  title,
  status,
  search = true,
  className,
}: {
  title: string;
  status?: ReactNode;
  search?: boolean;
  className?: string;
}) {
  const { role } = useStaff();
  return (
    <header
      className={cn(
        "mb-4 flex items-start justify-between gap-4 md:mb-5",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="font-display text-[22px] font-bold md:text-[26px]">
          {title}
        </h1>
        {status && (
          <div className="mt-0.5 text-sm text-muted-foreground">{status}</div>
        )}
      </div>
      <div className="hidden shrink-0 items-center gap-2 md:flex">
        {search && (
          <>
            <Form
              action="/receptionist/history"
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
                aria-label="Search today's tokens"
                placeholder="Search token or name"
                className="h-10 w-[240px] bg-card pl-9"
              />
            </Form>
            <Link
              href="/receptionist/history"
              aria-label="Search today's tokens"
              className={cn(ICON_BUTTON, "lg:hidden")}
            >
              <SearchIcon className="size-4" aria-hidden />
            </Link>
          </>
        )}
        <Link
          href={ACTIVITY_HREF[role]}
          aria-label="Recent activity"
          className={ICON_BUTTON}
        >
          <BellIcon className="size-4" aria-hidden />
        </Link>
        <AccountMenu
          variant="header"
          accountActions={
            <SignOutButton
              variant="ghost"
              className="h-9 w-full justify-start"
            />
          }
        />
      </div>
    </header>
  );
}
