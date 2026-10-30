import type { SubscriptionStatus } from "@/generated/prisma/enums";

// Revenue figures computed from plans and subscriptions. There is no payment
// provider yet, so these are what clinics would pay, not money received.

export type BillableSubscription = {
  status: SubscriptionStatus;
  plan: { priceMonthlyMinor: number; currency: string };
};

export type RevenueSummary = {
  currency: string;
  // Monthly recurring revenue from ACTIVE subscriptions.
  mrrMinor: number;
  // PAST_DUE subscriptions: revenue at risk.
  atRiskMinor: number;
  // TRIALING subscriptions: what trials would add if they convert.
  trialMinor: number;
  counts: Record<SubscriptionStatus, number>;
};

const EMPTY_COUNTS = (): Record<SubscriptionStatus, number> => ({
  TRIALING: 0,
  ACTIVE: 0,
  PAST_DUE: 0,
  CANCELLED: 0,
});

// One summary per currency, largest MRR first. Amounts are never converted
// between currencies.
export function summarizeRevenue(
  subscriptions: readonly BillableSubscription[],
): RevenueSummary[] {
  const byCurrency = new Map<string, RevenueSummary>();
  for (const { status, plan } of subscriptions) {
    let summary = byCurrency.get(plan.currency);
    if (!summary) {
      summary = {
        currency: plan.currency,
        mrrMinor: 0,
        atRiskMinor: 0,
        trialMinor: 0,
        counts: EMPTY_COUNTS(),
      };
      byCurrency.set(plan.currency, summary);
    }
    summary.counts[status] += 1;
    if (status === "ACTIVE") summary.mrrMinor += plan.priceMonthlyMinor;
    if (status === "PAST_DUE") summary.atRiskMinor += plan.priceMonthlyMinor;
    if (status === "TRIALING") summary.trialMinor += plan.priceMonthlyMinor;
  }
  return [...byCurrency.values()].sort(
    (a, b) => b.mrrMinor - a.mrrMinor || a.currency.localeCompare(b.currency),
  );
}

// e.g. 149900 INR → "₹1,499".
export function formatMinor(amountMinor: number, currency: string): string {
  const amount = amountMinor / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}
