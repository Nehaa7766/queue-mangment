import Link from "next/link";
import type { StaffTokenView } from "@/features/queue/contracts";
import { cn } from "@/lib/utils";
import { displayName, minutesSince } from "./token-display";

export type MiniTicketToken = Pick<
  StaffTokenView,
  "id" | "tokenLabel" | "patientName" | "serviceName" | "joinedAt"
>;

// One "Up next" row (docs/GUI_RULES.md §5). The whole row is the link, so it
// is one tap on phones; desktop also shows a "Details" hint.
export function MiniTicketRow({
  token,
  isNext,
  now,
  waitTargetMinutes,
  href,
}: {
  token: MiniTicketToken;
  isNext: boolean;
  now: number;
  waitTargetMinutes: number;
  href?: string;
}) {
  const waited = minutesSince(token.joinedAt, now);
  const overTarget = waited > waitTargetMinutes;

  const content = (
    <>
      <span
        className={cn(
          "flex w-[68px] shrink-0 items-center justify-center border-r-2 border-dashed border-background font-display text-lg font-extrabold tabular-nums",
          isNext ? "bg-slate text-white" : "bg-cream text-charcoal",
        )}
      >
        {token.tokenLabel}
      </span>
      <span className="flex min-w-0 flex-1 flex-col justify-center px-3 py-2.5">
        <span className="truncate text-sm font-semibold">
          {displayName(token.patientName)}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {token.serviceName}
          {isNext && " · next up"}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end justify-center px-3 py-2.5">
        <span
          className={cn(
            "text-sm font-semibold tabular-nums",
            overTarget && "text-terracotta-text",
          )}
        >
          <span aria-hidden>{waited}m</span>
          <span className="sr-only">{waited} minutes</span>
        </span>
        <span className="text-xs text-muted-foreground">
          {overTarget ? "over target" : "waited"}
        </span>
      </span>
      {href && (
        <span className="mr-3 hidden h-8 items-center self-center rounded-btn border border-border px-3 text-xs font-medium lg:inline-flex">
          Details
        </span>
      )}
    </>
  );

  const rowClass =
    "flex min-h-12 overflow-hidden rounded-[10px] border border-border bg-card";

  return (
    <li>
      {href ? (
        // The visible text is the accessible name, so voice control users can
        // say what they see.
        <Link
          href={href}
          className={cn(
            rowClass,
            "transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
          )}
        >
          {content}
        </Link>
      ) : (
        <div className={rowClass}>{content}</div>
      )}
    </li>
  );
}
