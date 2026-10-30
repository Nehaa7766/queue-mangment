import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TONE_BAR, type Tone } from "./tone";

// White card with a titled header, a body and an optional footer, e.g. a
// chart with summary numbers underneath (docs/GUI_RULES.md §5).
export function DashboardCard({
  title,
  description,
  action,
  children,
  footer,
  className,
  bodyClassName,
  id,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
  // For in-page links such as "#activity".
  id?: string;
}) {
  const titleId = useId();
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className={cn(
        "flex scroll-mt-20 flex-col overflow-hidden rounded-card border border-border bg-card shadow-card",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-divider px-5 py-4">
        <div className="min-w-0">
          <h2 id={titleId} className="text-[15px] font-semibold">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {action}
      </header>
      <div className={cn("flex-1 p-5", bodyClassName)}>{children}</div>
      {footer}
    </section>
  );
}

export type FooterStat = { label: string; value: ReactNode; tone: Tone };

// Summary numbers along the bottom of a card, each over a coloured line.
export function StatStrip({ stats }: { stats: FooterStat[] }) {
  return (
    // 1px gaps over a divider-coloured background draw the lines between
    // cells for any number of columns.
    <dl className="grid grid-cols-2 gap-px border-t border-divider bg-divider sm:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-col gap-1 bg-card px-5 py-4">
          <dt className="text-xs text-muted-foreground">{stat.label}</dt>
          <dd className="text-lg font-semibold tabular-nums">{stat.value}</dd>
          <span
            aria-hidden
            className={cn("h-0.5 w-3/4 rounded-full", TONE_BAR[stat.tone])}
          />
        </div>
      ))}
    </dl>
  );
}
