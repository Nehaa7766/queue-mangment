import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// White card with a 16px bold title (docs/GUI_RULES.md §4).
export function SectionCard({
  title,
  action,
  children,
  className,
  labelledBy,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  const id =
    labelledBy ?? `section-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "flex flex-col gap-3 rounded-card border border-border bg-card p-4 md:p-5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="font-display text-base font-bold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// Shown when a list has nothing in it.
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-btn bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
