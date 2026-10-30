import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TONE_BAR, type Tone } from "./tone";

// KPI card: icon circle, big value and label, then a caption with a coloured
// progress line underneath (docs/GUI_RULES.md §5).
export function StatCard({
  icon: Icon,
  value,
  label,
  footerLabel,
  footerValue,
  progress,
  tone = "brand",
  action,
  className,
}: {
  icon: LucideIcon;
  value: ReactNode;
  label: string;
  footerLabel?: string;
  footerValue?: ReactNode;
  // 0–100. The numbers are in the text, so the line is decoration only.
  progress?: number;
  tone?: Tone;
  // Top-right slot, e.g. a link to the full report.
  action?: ReactNode;
  className?: string;
}) {
  const width = Math.max(0, Math.min(100, progress ?? 0));
  return (
    <article
      className={cn(
        "flex flex-col rounded-card border border-border bg-card p-5 shadow-card",
        className,
      )}
    >
      <div className="flex items-start gap-3.5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-2xl leading-tight font-bold tabular-nums">
            {value}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">{label}</p>
        </div>
        {action}
      </div>
      {(footerLabel !== undefined || progress !== undefined) && (
        <div className="mt-5">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="text-muted-foreground">{footerLabel}</span>
            <span className="font-medium tabular-nums">{footerValue}</span>
          </div>
          {progress !== undefined && (
            <div aria-hidden className="mt-2 h-1 rounded-full bg-muted">
              <div
                className={cn("h-1 rounded-full", TONE_BAR[tone])}
                style={{ width: `${width}%` }}
              />
            </div>
          )}
        </div>
      )}
    </article>
  );
}
