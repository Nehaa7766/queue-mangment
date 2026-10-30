import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

// Small building blocks shared by the clinic admin pages.

export function AdminSection({
  title,
  description,
  actions,
  id,
  className,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      aria-label={headingId ? undefined : title}
      className={cn(
        "scroll-mt-20 rounded-card border border-border bg-card p-4 md:p-5",
        className,
      )}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={headingId} className="font-display text-base font-bold">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

const PILL_TONES = {
  done: "bg-status-done text-status-done-foreground",
  wait: "bg-status-wait text-status-wait-foreground",
  miss: "bg-status-miss text-status-miss-foreground",
  off: "bg-status-off text-status-off-foreground",
  slate: "bg-slate text-white",
  info: "bg-slate-tint text-slate",
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
        className="mt-0.5 size-5 shrink-0 accent-slate"
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
