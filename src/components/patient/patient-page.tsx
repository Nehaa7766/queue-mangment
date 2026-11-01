import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// White strip under the top bar with the clinic (or step) name, matching the
// staff page header. Full width, content in the patient column.
export function PatientStrip({
  eyebrow,
  title,
  aside,
  wide = false,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  // Right of the title, e.g. an "Open now" pill.
  aside?: ReactNode;
  // Match a wide PatientBody (the token page with its chat on desktop).
  wide?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="border-b border-border bg-card">
      <div
        className={cn(
          "mx-auto flex w-full max-w-md flex-col gap-2 px-4 py-5",
          wide && "lg:max-w-6xl lg:px-6",
        )}
      >
        {eyebrow && (
          <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>
        )}
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-display text-2xl leading-tight font-bold">
            {title}
          </h1>
          {aside && <div className="shrink-0 pt-0.5">{aside}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

// The patient column: phone width, centred on larger screens. `wide` lets a
// page use desktop width, e.g. the token beside its chat.
export function PatientBody({
  wide = false,
  children,
}: {
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6",
        wide && "lg:max-w-6xl lg:px-6",
      )}
    >
      {children}
    </div>
  );
}

// Small label-over-value block for the numbers a patient cares about.
export function PatientStat({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-card bg-muted p-4">
      <span className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
        {label}
      </span>
      <span className="font-display text-2xl leading-tight font-bold tabular-nums">
        {value}
      </span>
      {note && <span className="text-sm text-muted-foreground">{note}</span>}
    </div>
  );
}
