import Link from "next/link";
import {
  ANALYTICS_RANGES,
  type AnalyticsRange,
} from "@/features/platform/analytics-shape";
import { cn } from "@/lib/utils";

// 7 / 30 / 90 days switch for the dashboard charts, as plain links so it
// works before scripts load and the choice stays in the address.
export function RangeTabs({
  href,
  current,
}: {
  href: string;
  current: AnalyticsRange;
}) {
  return (
    <nav
      aria-label="Chart range"
      className="inline-flex h-9 items-center rounded-btn border border-border bg-card p-0.5"
    >
      {ANALYTICS_RANGES.map((range) => {
        const active = range === current;
        return (
          <Link
            key={range}
            href={`${href}?range=${range}`}
            aria-current={active ? "true" : undefined}
            className={cn(
              "inline-flex h-full items-center rounded-[6px] px-3 text-xs font-semibold tracking-wide uppercase outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              active
                ? "bg-brand text-white"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {range} days
          </Link>
        );
      })}
    </nav>
  );
}
