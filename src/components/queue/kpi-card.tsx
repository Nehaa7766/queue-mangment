import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type KpiTrend = {
  direction: "up" | "down" | "flat";
  // e.g. "+4"
  value: string;
  // Whether this direction is good news, which sets the colour.
  good: boolean;
  // e.g. "vs last hour"
  comparison: string;
};

const ARROWS = { up: "↗", down: "↘", flat: "→" } as const;

// KPI card (docs/GUI_RULES.md §5): label and value left, cream icon tile
// right, optional trend line below. Trends always carry an arrow, never
// colour alone.
export function KpiCard({
  label,
  value,
  icon: Icon,
  trend,
  caption,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: KpiTrend;
  caption?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] text-muted-foreground">{label}</p>
          <p className="font-display text-[26px] leading-tight font-bold tabular-nums">
            {value}
          </p>
        </div>
        <span
          aria-hidden
          className="flex size-[38px] shrink-0 items-center justify-center rounded-[10px] bg-cream text-slate"
        >
          <Icon className="size-5" />
        </span>
      </div>
      {trend ? (
        <p className="text-xs">
          <span
            className={cn(
              "font-semibold tabular-nums",
              trend.direction === "flat"
                ? "text-muted-foreground"
                : trend.good
                  ? "text-status-done-foreground"
                  : "text-terracotta-text",
            )}
          >
            {ARROWS[trend.direction]} {trend.value}
          </span>{" "}
          <span className="text-muted-foreground">{trend.comparison}</span>
        </p>
      ) : (
        caption && <p className="text-xs text-muted-foreground">{caption}</p>
      )}
    </div>
  );
}
