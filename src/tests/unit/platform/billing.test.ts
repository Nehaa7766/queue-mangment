import { describe, expect, it } from "vitest";
import {
  formatMinor,
  summarizeRevenue,
  type BillableSubscription,
} from "@/features/platform/billing";

const inr = (priceMonthlyMinor: number) => ({
  priceMonthlyMinor,
  currency: "INR",
});

describe("summarizeRevenue", () => {
  it("counts only ACTIVE subscriptions as recurring revenue", () => {
    const subscriptions: BillableSubscription[] = [
      { status: "ACTIVE", plan: inr(149_900) },
      { status: "ACTIVE", plan: inr(99_900) },
      { status: "PAST_DUE", plan: inr(149_900) },
      { status: "TRIALING", plan: inr(99_900) },
      { status: "TRIALING", plan: inr(0) },
      { status: "CANCELLED", plan: inr(149_900) },
    ];

    const [summary] = summarizeRevenue(subscriptions);

    expect(summary).toEqual({
      currency: "INR",
      mrrMinor: 249_800,
      atRiskMinor: 149_900,
      trialMinor: 99_900,
      counts: { ACTIVE: 2, PAST_DUE: 1, TRIALING: 2, CANCELLED: 1 },
    });
  });

  it("keeps currencies apart, largest MRR first", () => {
    const summaries = summarizeRevenue([
      { status: "ACTIVE", plan: { priceMonthlyMinor: 2_000, currency: "USD" } },
      { status: "ACTIVE", plan: inr(149_900) },
    ]);

    expect(summaries.map((s) => [s.currency, s.mrrMinor])).toEqual([
      ["INR", 149_900],
      ["USD", 2_000],
    ]);
  });

  it("returns nothing for no subscriptions", () => {
    expect(summarizeRevenue([])).toEqual([]);
  });
});

describe("formatMinor", () => {
  it("formats paise as rupees, without decimals for whole amounts", () => {
    expect(formatMinor(149_900, "INR")).toBe("₹1,499");
    expect(formatMinor(0, "INR")).toBe("₹0");
  });

  it("keeps paise when the amount isn't whole", () => {
    expect(formatMinor(149_950, "INR")).toBe("₹1,499.50");
  });

  it("uses Indian digit grouping", () => {
    expect(formatMinor(1_25_00_000_00, "INR")).toBe("₹1,25,00,000");
  });
});
