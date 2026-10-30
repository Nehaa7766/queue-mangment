"use client";

import { CalendarDaysIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useShellInfo } from "./shell-context";
import { TodayLabel } from "./today-label";

export type Crumb = { label: string; href?: string };

// White strip under the top bar: "Title | Home › Section › Page" on the
// left, today's date and the page's own actions on the right. It spans the
// full content width by cancelling the main area's padding.
export function PageHeader({
  title,
  breadcrumbs,
  status,
  actions,
  className,
}: {
  title: string;
  // Defaults to a single crumb with the title.
  breadcrumbs?: Crumb[];
  // A short line under the title, e.g. "Queue open".
  status?: ReactNode;
  actions?: ReactNode;
  className?: string;
  // Ignored: search lives in the top bar now. Kept so older pages compile.
  search?: boolean;
}) {
  const { homeHref } = useShellInfo();
  const crumbs = breadcrumbs ?? [{ label: title }];
  return (
    <div
      className={cn(
        "-mx-4 -mt-4 mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-border bg-card px-4 py-3.5 md:-mx-6 md:-mt-6 md:mb-6 md:px-6",
        className,
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-lg font-semibold">{title}</h1>
        <span aria-hidden className="hidden h-4 w-px bg-border sm:block" />
        <nav aria-label="Breadcrumb" className="hidden sm:block">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <li>
              <Link
                href={homeHref}
                className="rounded-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Home
              </Link>
            </li>
            {crumbs.map((crumb, index) => {
              const last = index === crumbs.length - 1;
              return (
                <li key={crumb.label} className="flex items-center gap-1.5">
                  <ChevronRightIcon className="size-3.5" aria-hidden />
                  {crumb.href && !last ? (
                    <Link href={crumb.href} className="hover:text-foreground">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span aria-current={last ? "page" : undefined}>
                      {crumb.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
        {status && (
          <div className="basis-full text-sm text-muted-foreground">
            {status}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="hidden h-9 items-center gap-2 rounded-btn border border-border bg-card px-3 text-xs font-semibold tracking-wide text-foreground uppercase sm:inline-flex">
          <CalendarDaysIcon
            className="size-4 text-muted-foreground"
            aria-hidden
          />
          <TodayLabel />
        </span>
        {actions}
      </div>
    </div>
  );
}
