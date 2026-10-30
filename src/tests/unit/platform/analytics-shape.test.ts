import { describe, expect, it } from "vitest";
import {
  dayKey,
  dayLabel,
  growthBuckets,
  parseRange,
  rangeDays,
  shapeClinicGrowth,
} from "@/features/platform/analytics-shape";

// 30 Oct 2026, 01:30 in India is still 29 Oct in UTC.
const NOW = new Date("2026-10-29T20:00:00.000Z");

describe("parseRange", () => {
  it("accepts 7, 30 and 90 and falls back to 30", () => {
    expect(parseRange("7")).toBe(7);
    expect(parseRange("90")).toBe(90);
    expect(parseRange("14")).toBe(30);
    expect(parseRange(undefined)).toBe(30);
    expect(parseRange("abc")).toBe(30);
  });
});

describe("days", () => {
  it("counts days in Indian time", () => {
    expect(dayKey(NOW)).toBe("2026-10-30");
    expect(dayKey(NOW, "UTC")).toBe("2026-10-29");
  });

  it("lists the range oldest first, ending today, across month ends", () => {
    const days = rangeDays(7, NOW);

    expect(days).toEqual([
      "2026-10-24",
      "2026-10-25",
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
    ]);
    expect(rangeDays(90, NOW)).toHaveLength(90);
    expect(rangeDays(30, new Date("2026-03-02T06:00:00Z"))[0]).toBe(
      "2026-02-01",
    );
  });

  it("labels a day like 14 Oct", () => {
    expect(dayLabel("2026-10-14")).toBe("14 Oct");
    expect(dayLabel("2026-01-01")).toBe("1 Jan");
  });
});

describe("growthBuckets", () => {
  it("uses days for a week", () => {
    const buckets = growthBuckets(rangeDays(7, NOW));

    expect(buckets).toHaveLength(7);
    expect(buckets[6]).toEqual({ label: "30 Oct", days: ["2026-10-30"] });
  });

  it("uses weeks counted back from today, so only the oldest is short", () => {
    const buckets = growthBuckets(rangeDays(30, NOW));

    expect(buckets.map((bucket) => bucket.days.length)).toEqual([
      2, 7, 7, 7, 7,
    ]);
    expect(buckets.at(-1)?.days.at(-1)).toBe("2026-10-30");
    expect(buckets.flatMap((bucket) => bucket.days)).toHaveLength(30);
  });
});

describe("shapeClinicGrowth", () => {
  const days = rangeDays(7, NOW);

  it("counts sign-ups and approvals per bucket and ignores older days", () => {
    const growth = shapeClinicGrowth({
      days,
      signupDays: ["2026-10-30", "2026-10-30", "2026-10-25", "2026-09-01"],
      approvalDays: ["2026-10-30"],
      suspensionDays: [],
      activeNow: 5,
    });

    expect(growth.points.at(-1)).toMatchObject({
      label: "30 Oct",
      signups: 2,
      approved: 1,
    });
    expect(growth.points[1]).toMatchObject({ label: "25 Oct", signups: 1 });
    expect(growth.totals).toEqual({
      signups: 3,
      approved: 1,
      suspended: 0,
      activeNow: 5,
    });
  });

  it("rebuilds active clinics backwards by undoing later approvals and suspensions", () => {
    const growth = shapeClinicGrowth({
      days,
      signupDays: [],
      approvalDays: ["2026-10-29", "2026-10-30"],
      suspensionDays: ["2026-10-30"],
      activeNow: 4,
    });

    // Today ends at 4. Before today: 4 − 1 approval + 1 suspension = 4.
    // Before the 29th: 4 − 1 = 3.
    expect(growth.points.map((point) => point.active)).toEqual([
      3, 3, 3, 3, 3, 4, 4,
    ]);
    expect(growth.totals.suspended).toBe(1);
  });

  it("never goes below zero", () => {
    const growth = shapeClinicGrowth({
      days,
      signupDays: [],
      approvalDays: ["2026-10-30", "2026-10-30"],
      suspensionDays: [],
      activeNow: 1,
    });

    expect(Math.min(...growth.points.map((point) => point.active))).toBe(0);
  });
});
