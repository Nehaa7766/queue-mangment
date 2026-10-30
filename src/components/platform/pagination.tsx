import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  pageItems,
  showingText,
  type Paginated,
} from "@/features/platform/pagination";
import { cn } from "@/lib/utils";

// Pager under a super-admin list: "Showing 11–20 of 57" and Previous, page
// numbers and Next, as links that keep the page's other search params (the
// caller's `href` adds them). Phones get "Page 2 of 6" with Previous and Next.

const ITEM =
  "inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-btn px-2.5 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const LINK = "text-foreground hover:bg-accent";
const OFF = "cursor-not-allowed text-muted-foreground opacity-50";

function Step({
  page,
  href,
  disabled,
  children,
  label,
}: {
  page: number;
  href: (page: number) => string;
  disabled: boolean;
  children: ReactNode;
  label: string;
}) {
  if (disabled) {
    return (
      <span aria-disabled="true" className={cn(ITEM, OFF)}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href(page)} aria-label={label} className={cn(ITEM, LINK)}>
      {children}
    </Link>
  );
}

export function Pagination({
  result,
  href,
  className,
}: {
  result: Pick<Paginated<unknown>, "page" | "pageCount" | "pageSize" | "total">;
  href: (page: number) => string;
  className?: string;
}) {
  const { page, pageCount, pageSize, total } = result;
  if (total === 0) return null;
  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-divider px-5 py-3",
        className,
      )}
    >
      <p className="text-sm text-muted-foreground tabular-nums">
        {showingText(page, pageSize, total)}
      </p>
      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <Step
            page={page - 1}
            href={href}
            disabled={page <= 1}
            label="Previous page"
          >
            <ChevronLeftIcon className="size-4" aria-hidden />
            <span>Previous</span>
          </Step>
          <span className="px-2 text-sm text-muted-foreground tabular-nums sm:hidden">
            Page {page} of {pageCount}
          </span>
          <ul className="hidden items-center gap-1 sm:flex">
            {pageItems(page, pageCount).map((item, index) =>
              item === "gap" ? (
                <li
                  key={`gap-${index}`}
                  aria-hidden
                  className="px-1 text-sm text-muted-foreground"
                >
                  …
                </li>
              ) : (
                <li key={item}>
                  <Link
                    href={href(item)}
                    aria-label={`Page ${item}`}
                    aria-current={item === page ? "page" : undefined}
                    className={cn(
                      ITEM,
                      "tabular-nums",
                      item === page
                        ? "bg-brand-tint font-semibold text-brand"
                        : LINK,
                    )}
                  >
                    {item}
                  </Link>
                </li>
              ),
            )}
          </ul>
          <Step
            page={page + 1}
            href={href}
            disabled={page >= pageCount}
            label="Next page"
          >
            <span>Next</span>
            <ChevronRightIcon className="size-4" aria-hidden />
          </Step>
        </div>
      )}
    </nav>
  );
}
