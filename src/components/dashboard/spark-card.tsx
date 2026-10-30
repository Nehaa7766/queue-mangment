import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Sparkline } from "./sparkline";
import { TONE_HEX, TONE_TEXT, type Tone } from "./tone";

// Small card: title and value on top, a coloured sparkline and a trend note
// below (docs/GUI_RULES.md §5). A server component, so pages can pass the
// icon directly; only the Sparkline inside runs on the client.
export function SparkCard({
  icon: Icon,
  title,
  subtitle,
  value,
  series,
  tone = "brand",
  trend,
  className,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  value: ReactNode;
  // The shape only, so it is hidden from screen readers.
  series: number[];
  tone?: Tone;
  // e.g. { label: "+4", caption: "vs yesterday" }. Always words, not colour alone.
  trend?: { label: string; caption: string };
  className?: string;
}) {
  return (
    <article
      className={cn(
        "flex flex-col rounded-card border border-border bg-card shadow-card",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-divider p-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground">
            <Icon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{title}</h3>
            {subtitle && (
              <p className="truncate text-xs text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <p className="font-display text-2xl font-bold tabular-nums">{value}</p>
      </div>
      <div className="flex items-end gap-4 p-4">
        <div aria-hidden className="h-16 min-w-0 flex-1">
          <Sparkline series={series} color={TONE_HEX[tone]} />
        </div>
        {trend && (
          <p className="shrink-0 text-right text-xs">
            <span className={cn("block font-semibold", TONE_TEXT[tone])}>
              {trend.label}
            </span>
            <span className="text-muted-foreground">{trend.caption}</span>
          </p>
        )}
      </div>
    </article>
  );
}
