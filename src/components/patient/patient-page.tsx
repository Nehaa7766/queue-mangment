import type { ReactNode } from "react";

// White strip under the top bar with the clinic (or step) name, matching the
// staff page header. Full width, content in the patient column.
export function PatientStrip({
  eyebrow,
  title,
  aside,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  // Right of the title, e.g. an "Open now" pill.
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="border-b border-border bg-card">
      <div className="mx-auto flex w-full max-w-md flex-col gap-2 px-4 py-5">
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

// The patient column: phone width, centred on larger screens.
export function PatientBody({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
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
