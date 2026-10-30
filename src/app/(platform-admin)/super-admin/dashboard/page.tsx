import {
  Building2Icon,
  HourglassIcon,
  LifeBuoyIcon,
  WalletIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ClinicStatusButton } from "@/components/platform/clinic-status-button";
import { formatDate, formatDateTime } from "@/components/platform/pills";
import {
  PlatformPageHeader,
  PlatformPageSkeleton,
} from "@/components/platform/platform-shell";
import { requirePlatformPage } from "@/components/platform/platform-session";
import { EmptyState, SectionCard } from "@/components/platform/section-card";
import { KpiCard } from "@/components/queue/kpi-card";
import { ACTION_LABELS } from "@/features/platform/activity";
import { formatMinor } from "@/features/platform/billing";
import { getPlatformDashboard } from "@/features/platform/dashboard";

export const metadata: Metadata = { title: "Platform overview · QueueCare" };

export default function PlatformDashboardPage() {
  return (
    <Suspense fallback={<PlatformPageSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  await requirePlatformPage();
  const dashboard = await getPlatformDashboard();
  const inr = dashboard.revenue.find((summary) => summary.currency === "INR");
  const mrr = inr
    ? formatMinor(inr.mrrMinor, "INR")
    : dashboard.revenue[0]
      ? formatMinor(
          dashboard.revenue[0].mrrMinor,
          dashboard.revenue[0].currency,
        )
      : formatMinor(0, "INR");

  return (
    <>
      <PlatformPageHeader
        title="Platform overview"
        description="Clinics, subscriptions and support across QueueCare."
      />

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <KpiCard
          label="Active clinics"
          value={dashboard.clinics.active}
          icon={Building2Icon}
          caption={`${dashboard.clinics.suspended} suspended`}
        />
        <KpiCard
          label="Pending approval"
          value={dashboard.clinics.pending}
          icon={HourglassIcon}
          caption="New sign-ups waiting"
        />
        <KpiCard
          label="Estimated MRR"
          value={mrr}
          icon={WalletIcon}
          caption="Active subscriptions; no payments connected"
        />
        <KpiCard
          label="Open tickets"
          value={dashboard.openTickets}
          icon={LifeBuoyIcon}
          caption="Open or in progress"
        />
      </div>

      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-2">
        <SectionCard
          title="Waiting for approval"
          action={
            <Link
              href="/super-admin/clinics?status=PENDING"
              className="text-sm font-medium text-slate underline-offset-4 hover:underline"
            >
              All pending
            </Link>
          }
        >
          {dashboard.pendingClinics.length === 0 ? (
            <EmptyState>No clinics are waiting.</EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-divider">
              {dashboard.pendingClinics.slice(0, 6).map((clinic) => (
                <li
                  key={clinic.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/super-admin/clinics/${clinic.id}`}
                      className="font-semibold underline-offset-4 hover:underline"
                    >
                      {clinic.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      /q/{clinic.slug} · signed up{" "}
                      {formatDate(clinic.createdAt)}
                    </p>
                  </div>
                  <ClinicStatusButton
                    clinicId={clinic.id}
                    clinicName={clinic.name}
                    lifecycle={clinic.lifecycle}
                  />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Recent platform activity"
          action={
            <Link
              href="/super-admin/activity"
              className="text-sm font-medium text-slate underline-offset-4 hover:underline"
            >
              Activity log
            </Link>
          }
        >
          {dashboard.recentActivity.length === 0 ? (
            <EmptyState>No platform actions yet.</EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-divider">
              {dashboard.recentActivity.map((event) => (
                <li
                  key={event.id}
                  className="flex items-start justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {ACTION_LABELS[event.action] ?? event.action}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {event.actorName ?? "System"}
                    </p>
                  </div>
                  <time
                    dateTime={event.createdAt}
                    className="shrink-0 text-xs text-muted-foreground tabular-nums"
                  >
                    {formatDateTime(event.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}
