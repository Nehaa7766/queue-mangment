import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Tables for the platform lists: a muted header row, divider rows, and side
// scrolling inside the card on small screens instead of on the page.

export const TH =
  "bg-muted px-5 py-2.5 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase";
export const TD = "px-5 py-3.5 align-middle";
export const TR =
  "border-t border-divider transition-colors hover:bg-accent/50";

export function DataTable({
  label,
  minWidth = 640,
  children,
}: {
  // Names the table for screen readers.
  label: string;
  minWidth?: number;
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table aria-label={label} className="w-full text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

// Header cells for a table; pass `align` for numeric columns.
export function HeaderRow({
  columns,
}: {
  columns: { label: ReactNode; align?: "right"; srOnly?: boolean }[];
}) {
  return (
    <thead>
      <tr>
        {columns.map((column, index) => (
          <th
            key={index}
            scope="col"
            className={cn(TH, column.align === "right" && "text-right")}
          >
            {column.srOnly ? (
              <span className="sr-only">{column.label}</span>
            ) : (
              column.label
            )}
          </th>
        ))}
      </tr>
    </thead>
  );
}
