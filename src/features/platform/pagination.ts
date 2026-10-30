// Page maths for the super-admin lists. Pure and client-safe.

export const PAGE_SIZE = 20;

// One page of a list, with what the pager needs to draw itself.
export type Paginated<T> = {
  rows: T[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
};

// "?page=3" → 3. Anything else (missing, 0, "abc", "2.5") → 1.
export function parsePage(value: string | undefined): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

// The page actually shown: a page past the end shows the last one, and an
// empty list still has page 1.
export function pageWindow(
  requested: number,
  total: number,
  pageSize: number,
): { page: number; pageCount: number; skip: number } {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Math.floor(requested) || 1), pageCount);
  return { page, pageCount, skip: (page - 1) * pageSize };
}

export type PageItem = number | "gap";

// Page numbers for the pager: always the first and last, the current page
// with one either side, and a gap where pages are left out. A gap is never
// shown for a single page; that page is shown instead.
// pageItems(6, 12) → [1, "gap", 5, 6, 7, "gap", 12]
export function pageItems(current: number, pageCount: number): PageItem[] {
  const shown = new Set([1, pageCount, current - 1, current, current + 1]);
  const pages = [...shown]
    .filter((page) => page >= 1 && page <= pageCount)
    .sort((a, b) => a - b);
  const items: PageItem[] = [];
  for (const page of pages) {
    const previous = items.at(-1);
    if (typeof previous === "number" && page - previous === 2) {
      items.push(previous + 1);
    } else if (typeof previous === "number" && page - previous > 2) {
      items.push("gap");
    }
    items.push(page);
  }
  return items;
}

// "Showing 11–20 of 57".
export function showingText(
  page: number,
  pageSize: number,
  total: number,
): string {
  if (total === 0) return "Showing 0 of 0";
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return `Showing ${first}–${last} of ${total}`;
}
