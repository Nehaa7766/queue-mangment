import { describe, expect, it } from "vitest";
import { formatEta, formatUpdatedAgo } from "@/components/patient/format";
import { UPDATED_AT } from "./fixtures";

describe("formatEta", () => {
  it("shows a range", () => {
    expect(formatEta({ minMinutes: 10, maxMinutes: 20, isRough: false })).toBe(
      "10–20 min",
    );
  });

  it("shows an upper bound when the wait could be zero", () => {
    expect(formatEta({ minMinutes: 0, maxMinutes: 5, isRough: true })).toBe(
      "Up to 5 min",
    );
  });
});

describe("formatUpdatedAgo", () => {
  const updated = Date.parse(UPDATED_AT);

  it("says just now within the first minute", () => {
    expect(formatUpdatedAgo(UPDATED_AT, updated + 59_000)).toBe(
      "Updated just now",
    );
  });

  it("counts whole minutes", () => {
    expect(formatUpdatedAgo(UPDATED_AT, updated + 60_000)).toBe(
      "Updated 1 min ago",
    );
    expect(formatUpdatedAgo(UPDATED_AT, updated + 5 * 60_000 + 30_000)).toBe(
      "Updated 5 min ago",
    );
  });

  it("treats a bad timestamp as just now", () => {
    expect(formatUpdatedAgo("not a date", updated)).toBe("Updated just now");
  });
});
