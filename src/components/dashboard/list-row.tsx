import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// One line in a card list: a leading badge, title and subtitle, and a value
// on the right (docs/GUI_RULES.md §5). The whole row links when href is set.
export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  trailingSub,
  href,
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  trailingSub?: ReactNode;
  href?: string;
}) {
  const content = (
    <>
      {leading}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold">{title}</span>
        {subtitle && (
          <span className="truncate text-xs text-muted-foreground">
            {subtitle}
          </span>
        )}
      </span>
      {(trailing || trailingSub) && (
        <span className="flex shrink-0 flex-col items-end">
          <span className="text-sm font-semibold tabular-nums">{trailing}</span>
          {trailingSub && (
            <span className="text-xs text-muted-foreground">{trailingSub}</span>
          )}
        </span>
      )}
    </>
  );
  const rowClass = "flex items-center gap-3 py-3.5";
  return href ? (
    <Link
      href={href}
      className={cn(
        rowClass,
        "-mx-5 px-5 transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
      )}
    >
      {content}
    </Link>
  ) : (
    <div className={rowClass}>{content}</div>
  );
}

// Square badge with a token label, like an app icon in the reference lists.
export function TokenBadge({
  label,
  tone = "brand",
}: {
  label: string;
  tone?: "brand" | "muted";
}) {
  return (
    <span
      className={cn(
        "flex h-10 min-w-12 shrink-0 items-center justify-center rounded-btn px-2 font-display text-sm font-extrabold tabular-nums",
        tone === "brand"
          ? "bg-brand-tint text-brand"
          : "bg-muted text-foreground",
      )}
    >
      {label}
    </span>
  );
}
