import Link from "next/link";
import type { ReactNode } from "react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { cn } from "@/lib/utils";

// White card with a titled header (docs/GUI_RULES.md §5). The platform pages
// and the clinic support page use it; it is the shared DashboardCard.
export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  // e.g. "p-0" for a table that runs edge to edge.
  bodyClassName?: string;
}) {
  return (
    <DashboardCard
      title={title}
      description={description}
      action={action}
      className={className}
      bodyClassName={bodyClassName}
    >
      {children}
    </DashboardCard>
  );
}

// Label and value pairs on the detail pages. Put DetailRows inside.
export function DetailList({ children }: { children: ReactNode }) {
  return <dl className="flex flex-col divide-y divide-divider">{children}</dl>;
}

export function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:gap-4">
      <dt className="w-36 shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm break-words">{children}</dd>
    </div>
  );
}

// Shown when a list has nothing in it.
export function EmptyState({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "rounded-btn bg-muted px-4 py-6 text-center text-sm text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}

// Small text link for a card header, e.g. "All pending".
export function CardLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="shrink-0 text-sm font-medium text-brand underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {children}
    </Link>
  );
}

// A list page's card: no title (the page header already names the list),
// an optional toolbar row for filters, search and the count, then the table.
export function ListCard({
  toolbar,
  children,
}: {
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
      {toolbar && (
        <div className="flex flex-col gap-3 border-b border-divider px-5 py-4 md:flex-row md:items-center md:justify-between">
          {toolbar}
        </div>
      )}
      {children}
    </div>
  );
}

// "3 clinics" in a list toolbar.
export function ListCount({
  count,
  one,
  many,
}: {
  count: number;
  one: string;
  many: string;
}) {
  return (
    <p className="text-sm text-muted-foreground tabular-nums">
      {count} {count === 1 ? one : many}
    </p>
  );
}
