import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Pagination } from "@/components/platform/pagination";
import {
  pageItems,
  pageWindow,
  parsePage,
  showingText,
} from "@/features/platform/pagination";

describe("parsePage", () => {
  it("reads whole page numbers and falls back to 1", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-2")).toBe(1);
    expect(parsePage("2.5")).toBe(1);
    expect(parsePage("abc")).toBe(1);
  });
});

describe("pageWindow", () => {
  it("skips the earlier pages", () => {
    expect(pageWindow(2, 57, 20)).toEqual({ page: 2, pageCount: 3, skip: 20 });
  });

  it("shows the last page for a page past the end", () => {
    expect(pageWindow(9, 57, 20)).toEqual({ page: 3, pageCount: 3, skip: 40 });
  });

  it("has one empty page when there is nothing", () => {
    expect(pageWindow(4, 0, 20)).toEqual({ page: 1, pageCount: 1, skip: 0 });
  });
});

describe("pageItems", () => {
  it("lists every page when there are few", () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("puts gaps around the current page in a long range", () => {
    expect(pageItems(6, 12)).toEqual([1, "gap", 5, 6, 7, "gap", 12]);
    expect(pageItems(1, 12)).toEqual([1, 2, "gap", 12]);
    expect(pageItems(12, 12)).toEqual([1, "gap", 11, 12]);
  });

  it("shows a single left-out page instead of a gap", () => {
    expect(pageItems(4, 12)).toEqual([1, 2, 3, 4, 5, "gap", 12]);
  });
});

describe("showingText", () => {
  it("says which rows are on the page", () => {
    expect(showingText(2, 10, 57)).toBe("Showing 11–20 of 57");
    expect(showingText(6, 10, 57)).toBe("Showing 51–57 of 57");
    expect(showingText(1, 20, 0)).toBe("Showing 0 of 0");
  });
});

describe("Pagination", () => {
  const href = (page: number) => `/super-admin/users?tab=staff&page=${page}`;

  it("links each page with the other params and marks the current one", () => {
    render(
      <Pagination
        result={{ page: 2, pageCount: 6, pageSize: 20, total: 115 }}
        href={href}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Pagination" });

    expect(within(nav).getByText("Showing 21–40 of 115")).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Page 2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      within(nav).getByRole("link", { name: "Previous page" }),
    ).toHaveAttribute("href", "/super-admin/users?tab=staff&page=1");
    expect(
      within(nav).getByRole("link", { name: "Next page" }),
    ).toHaveAttribute("href", "/super-admin/users?tab=staff&page=3");
    expect(within(nav).getByText("Page 2 of 6")).toBeInTheDocument();
  });

  it("disables Previous on the first page without making it a link", () => {
    render(
      <Pagination
        result={{ page: 1, pageCount: 3, pageSize: 20, total: 45 }}
        href={href}
      />,
    );

    expect(screen.queryByRole("link", { name: "Previous page" })).toBeNull();
    expect(
      screen.getByText("Previous").closest("[aria-disabled]"),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("shows only the count for one page, and nothing for an empty list", () => {
    const { rerender } = render(
      <Pagination
        result={{ page: 1, pageCount: 1, pageSize: 20, total: 3 }}
        href={href}
      />,
    );
    expect(screen.getByText("Showing 1–3 of 3")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();

    rerender(
      <Pagination
        result={{ page: 1, pageCount: 1, pageSize: 20, total: 0 }}
        href={href}
      />,
    );
    expect(screen.queryByRole("navigation")).toBeNull();
  });
});
