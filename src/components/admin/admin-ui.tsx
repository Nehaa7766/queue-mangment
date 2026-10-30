import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Small building blocks shared by the clinic admin pages. Sections match the
// dashboard cards (src/components/dashboard): white, titled header strip,
// thin border and a soft shadow.

export function AdminSection({
  title,
  description,
  actions,
  id,
  flush = false,
  className,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  // Anchor for links such as /admin/settings#hours.
  id?: string;
  // No body padding, for tables and lists that run edge to edge.
  flush?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn(
        "scroll-mt-20 overflow-hidden rounded-card border border-border bg-card shadow-card",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-divider px-5 py-4">
        <div className="min-w-0">
          <h2 id={headingId} className="text-[15px] font-semibold">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions}
      </div>
      <div className={flush ? undefined : "p-5"}>{children}</div>
    </section>
  );
}

const PILL_TONES = {
  done: "bg-status-done text-status-done-foreground",
  wait: "bg-status-wait text-status-wait-foreground",
  miss: "bg-status-miss text-status-miss-foreground",
  off: "bg-status-off text-status-off-foreground",
  brand: "bg-brand text-white",
  info: "bg-brand-tint text-brand",
} as const;

export type PillTone = keyof typeof PILL_TONES;

// Status pill: colour plus a text label, never colour alone.
export function Pill({
  tone,
  children,
  className,
}: {
  tone: PillTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        PILL_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ---- Tables: muted header row, divider lines, edge-to-edge in a flush
// AdminSection. Wide tables scroll sideways on phones. ----

export function DataTable({
  caption,
  minWidth = 560,
  children,
}: {
  caption: string;
  minWidth?: number;
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth }}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function DataTableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-background text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </thead>
  );
}

export function DataTableBody({ children }: { children: ReactNode }) {
  return (
    <tbody className="divide-y divide-divider tabular-nums">{children}</tbody>
  );
}

// Header cell. First and last cells line up with the card's 20px padding.
export function Th({
  align = "left",
  className,
  ...props
}: ComponentProps<"th"> & { align?: "left" | "right" | "center" }) {
  return (
    <th
      scope="col"
      className={cn(
        "px-3 py-3 font-semibold first:pl-5 last:pr-5",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    />
  );
}

export function Td({
  align = "left",
  className,
  ...props
}: ComponentProps<"td"> & { align?: "left" | "right" | "center" }) {
  return (
    <td
      className={cn(
        "px-3 py-3 first:pl-5 last:pr-5",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    />
  );
}

// Row header cell, for the first column of a data row.
export function RowTh({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      scope="row"
      className={cn(
        "px-3 py-3 text-left font-semibold first:pl-5 last:pr-5",
        className,
      )}
      {...props}
    />
  );
}

// Native select styled like the text inputs: reliable on phones and with
// screen readers, and simple to test.
export function NativeSelect({
  className,
  ...props
}: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-10 w-full min-w-0 rounded-lg border border-input bg-card px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

// Checkbox with a visible label and a large tap target.
export function CheckboxField({
  label,
  description,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & {
  label: ReactNode;
  description?: ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-start gap-3 rounded-btn py-2 has-disabled:cursor-not-allowed has-disabled:opacity-60",
        className,
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 size-5 shrink-0 accent-brand"
        {...props}
      />
      <span className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        {description && (
          <span className="text-xs text-muted-foreground">{description}</span>
        )}
      </span>
    </label>
  );
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
