import { HourglassIcon, TriangleAlertIcon, WalletIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import {
  PlatformPageHeader,
  PlatformPageSkeleton,
} from "@/components/platform/platform-shell";
import { requirePlatformPage } from "@/components/platform/platform-session";
import { EmptyState, SectionCard } from "@/components/platform/section-card";
import { KpiCard } from "@/components/queue/kpi-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatMinor, summarizeRevenue } from "@/features/platform/billing";
import {
  SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_STATUS_LABELS,
} from "@/features/platform/schemas";
import {
  listBillableSubscriptions,
  listPlans,
} from "@/features/platform/subscriptions";

export const metadata: Metadata = { title: "Billing overview · QueueCare" };

export default function BillingPage() {
  return (
    <Suspense fallback={<PlatformPageSkeleton />}>
      <Billing />
    </Suspense>
  );
}

async function Billing() {
  await requirePlatformPage();
  const [subscriptions, plans] = await Promise.all([
    listBillableSubscriptions(),
    listPlans(),
  ]);
  const revenue = summarizeRevenue(subscriptions);

  return (
    <>
      <PlatformPageHeader
        title="Billing overview"
        description="Estimates from plans and subscriptions."
      />
      <Alert className="mb-4">
        <AlertDescription>
          No payment provider is connected yet, so these are amounts clinics
          would pay, not money received. See docs/COMMERCIAL.md.
        </AlertDescription>
      </Alert>

      {revenue.length === 0 ? (
        <EmptyState>No subscriptions yet.</EmptyState>
      ) : (
        revenue.map((summary) => (
          <div
            key={summary.currency}
            className="mb-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-3"
          >
            <KpiCard
              label={`Monthly recurring revenue (${summary.currency})`}
              value={formatMinor(summary.mrrMinor, summary.currency)}
              icon={WalletIcon}
              caption={`${summary.counts.ACTIVE} active`}
            />
            <KpiCard
              label="At risk"
              value={formatMinor(summary.atRiskMinor, summary.currency)}
              icon={TriangleAlertIcon}
              caption={`${summary.counts.PAST_DUE} past due`}
            />
            <KpiCard
              label="In trial"
              value={formatMinor(summary.trialMinor, summary.currency)}
              icon={HourglassIcon}
              caption={`${summary.counts.TRIALING} trialing`}
            />
          </div>
        ))
      )}

      <SectionCard title="By plan">
        {plans.length === 0 ? (
          <EmptyState>No plans yet.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Plan
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Price
                  </th>
                  {SUBSCRIPTION_STATUSES.map((status) => (
                    <th
                      key={status}
                      scope="col"
                      className="py-2 pr-3 text-right font-semibold"
                    >
                      {SUBSCRIPTION_STATUS_LABELS[status]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => {
                  const forPlan = subscriptions.filter(
                    (s) => s.planId === plan.id,
                  );
                  return (
                    <tr key={plan.id} className="border-b border-divider">
                      <th
                        scope="row"
                        className="py-2 pr-3 text-left font-semibold"
                      >
                        {plan.name}
                        {!plan.isActive && (
                          <span className="ml-1 font-normal text-muted-foreground">
                            (retired)
                          </span>
                        )}
                      </th>
                      <td className="py-2 pr-3 tabular-nums">
                        {formatMinor(plan.priceMonthlyMinor, plan.currency)}
                        /month
                      </td>
                      {SUBSCRIPTION_STATUSES.map((status) => (
                        <td
                          key={status}
                          className="py-2 pr-3 text-right tabular-nums"
                        >
                          {forPlan.filter((s) => s.status === status).length}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}
