"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";
import { Area, AreaChart, YAxis } from "recharts";

// Headroom above the highest value, so a flat series draws a line part-way up
// instead of filling the whole chart.
const Y_DOMAIN: [number, (dataMax: number) => number] = [
  0,
  (dataMax) => (dataMax > 0 ? dataMax * 1.4 : 1),
];
import { cn } from "@/lib/utils";

// Mocha card with a big number and a white wave chart, then a list and a
// footer link (docs/GUI_RULES.md §5). Use once per dashboard, for the thing
// that matters most right now.
export function HighlightCard({
  value,
  label,
  badge,
  series,
  children,
  footer,
  className,
}: {
  value: ReactNode;
  label: string;
  badge?: string;
  // Recent values for the wave; the shape only, so it is hidden from
  // screen readers.
  series: number[];
  children: ReactNode;
  footer?: { href: string; label: string };
  className?: string;
}) {
  const titleId = useId();
  const data = (series.length > 1 ? series : [0, 0]).map((v, i) => ({
    i,
    v,
  }));
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "flex flex-col overflow-hidden rounded-card border border-border bg-card shadow-card",
        className,
      )}
    >
      <div className="bg-brand pt-5 text-white">
        <div className="flex items-start justify-between gap-3 px-5">
          <div>
            <p className="font-display text-3xl leading-tight font-bold tabular-nums">
              {value}
            </p>
            <h2 id={titleId} className="text-sm text-brand-muted">
              {label}
            </h2>
          </div>
          {badge && (
            <span className="rounded-btn bg-white px-2 py-0.5 text-xs font-semibold text-brand">
              {badge}
            </span>
          )}
        </div>
        <div aria-hidden className="mt-2">
          <AreaChart
            responsive
            accessibilityLayer={false}
            data={data}
            margin={{ top: 8, right: 0, bottom: 0, left: 0 }}
            style={{ width: "100%", height: 96 }}
          >
            <YAxis hide domain={Y_DOMAIN} />
            <Area
              type="monotone"
              dataKey="v"
              stroke="rgb(255 255 255 / 0.9)"
              strokeWidth={2}
              fill="rgb(255 255 255 / 0.22)"
              isAnimationActive={false}
            />
          </AreaChart>
        </div>
      </div>
      <div className="flex-1 divide-y divide-divider px-5">{children}</div>
      {footer && (
        <Link
          href={footer.href}
          className="border-t border-divider py-3.5 text-center text-xs font-semibold tracking-wider text-brand uppercase transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {footer.label}
        </Link>
      )}
    </section>
  );
}
