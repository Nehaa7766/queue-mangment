import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SubscriptionPill, formatDate } from "@/components/platform/pills";
import {
  PlatformPageHeader,
  PlatformPageSkeleton,
} from "@/components/platform/platform-shell";
import { requirePlatformPage } from "@/components/platform/platform-session";
import { EmptyState } from "@/components/platform/section-card";
import { formatMinor } from "@/features/platform/billing";
import { listSubscriptions } from "@/features/platform/subscriptions";

export const metadata: Metadata = {
  title: "Plans and subscriptions · QueueCare",
};

export default function SubscriptionsPage() {
  return (
    <Suspense fallback={<PlatformPageSkeleton />}>
      <Subscriptions />
    </Suspense>
  );
}

async function Subscriptions() {
  await requirePlatformPage();
  const rows = await listSubscriptions();

  return (
    <>
      <PlatformPageHeader
        title="Plans and subscriptions"
        description="Managed by hand until a payment provider is connected."
      />
      {rows.length === 0 ? (
        <EmptyState>No clinics yet.</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y divide-divider rounded-card border border-border bg-card">
          {rows.map((row) => (
            <li
              key={row.clinicId}
              className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold">{row.clinicName}</p>
                {row.subscription ? (
                  <p className="text-xs text-muted-foreground">
                    {row.subscription.planName} ·{" "}
                    {formatMinor(
                      row.subscription.priceMonthlyMinor,
                      row.subscription.currency,
                    )}
                    /month · trial ends{" "}
                    {formatDate(row.subscription.trialEndsAt)} · period ends{" "}
                    {formatDate(row.subscription.currentPeriodEnd)}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No subscription
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {row.subscription && (
                  <SubscriptionPill status={row.subscription.status} />
                )}
                <Link
                  href={`/super-admin/subscriptions/${row.clinicId}`}
                  className="inline-flex h-10 items-center rounded-btn border border-border bg-card px-4 text-sm font-medium outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {row.subscription ? "Edit" : "Set up"}
                  <span className="sr-only">
                    {" "}
                    subscription for {row.clinicName}
                  </span>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
