import Link from "next/link";
import { cn } from "@/lib/utils";

// Link chips for list filters; the active chip is filled in the brand colour.
export function FilterChips({
  label,
  chips,
}: {
  label: string;
  chips: { label: string; href: string; active: boolean }[];
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <Link
          key={chip.href}
          href={chip.href}
          aria-current={chip.active ? "true" : undefined}
          className={cn(
            "inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            chip.active
              ? "border-brand bg-brand text-white"
              : "border-border bg-card hover:bg-accent",
          )}
        >
          {chip.label}
        </Link>
      ))}
    </nav>
  );
}

// GET search form that keeps the other filters.
export function SearchForm({
  action,
  label,
  placeholder,
  defaultValue,
  hidden,
}: {
  action: string;
  label: string;
  placeholder: string;
  defaultValue?: string;
  hidden?: Record<string, string | undefined>;
}) {
  return (
    <form action={action} role="search" className="flex gap-2">
      {Object.entries(hidden ?? {}).map(([name, value]) =>
        value ? (
          <input key={name} type="hidden" name={name} value={value} />
        ) : null,
      )}
      <label htmlFor={`${action}-q`} className="sr-only">
        {label}
      </label>
      <input
        id={`${action}-q`}
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-10 w-full min-w-0 rounded-btn border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-72"
      />
      <button
        type="submit"
        className="h-10 shrink-0 rounded-btn border border-border bg-card px-4 text-sm font-medium outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        Search
      </button>
    </form>
  );
}

export function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
