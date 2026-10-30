import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ClinicStatusButton } from "@/components/platform/clinic-status-button";
import {
  LifecyclePill,
  SubscriptionPill,
  formatDate,
} from "@/components/platform/pills";
import {
  PlatformPageHeader,
  PlatformPageSkeleton,
} from "@/components/platform/platform-shell";
import { requirePlatformPage } from "@/components/platform/platform-session";
import { EmptyState, SectionCard } from "@/components/platform/section-card";
import { ROLE_LABELS } from "@/components/layout/staff-nav";
import { getClinicDetail } from "@/features/platform/clinics";

export const metadata: Metadata = { title: "Clinic · QueueCare" };

type Params = PageProps<"/super-admin/clinics/[clinicId]">["params"];

export default function ClinicDetailPage({
  params,
}: PageProps<"/super-admin/clinics/[clinicId]">) {
  return (
    <Suspense fallback={<PlatformPageSkeleton />}>
      <ClinicDetail params={params} />
    </Suspense>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="w-36 shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

async function ClinicDetail({ params }: { params: Params }) {
  await requirePlatformPage();
  const clinic = await getClinicDetail((await params).clinicId);
  if (!clinic) notFound();

  return (
    <>
      <Link
        href="/super-admin/clinics"
        className="mb-2 inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-slate underline-offset-4 hover:underline"
      >
        <ArrowLeftIcon className="size-4" aria-hidden />
        All clinics
      </Link>
      <PlatformPageHeader
        title={clinic.name}
        description={<LifecyclePill lifecycle={clinic.lifecycle} />}
        actions={
          <ClinicStatusButton
            clinicId={clinic.id}
            clinicName={clinic.name}
            lifecycle={clinic.lifecycle}
          />
        }
      />

      <div className="grid gap-3.5 lg:grid-cols-2">
        <SectionCard title="Details">
          <dl className="flex flex-col gap-2">
            <Row label="Public page">
              {clinic.status === "ACTIVE" ? (
                <Link
                  href={`/q/${clinic.slug}`}
                  className="text-slate underline-offset-4 hover:underline"
                >
                  /q/{clinic.slug}
                </Link>
              ) : (
                <span>/q/{clinic.slug} (offline until active)</span>
              )}
            </Row>
            <Row label="Time zone">{clinic.timezone}</Row>
            <Row label="Address">{clinic.address ?? "—"}</Row>
            <Row label="Phone">{clinic.phone ?? "—"}</Row>
            <Row label="Created">{formatDate(clinic.createdAt)}</Row>
          </dl>
        </SectionCard>

        <SectionCard
          title="Subscription"
          action={
            <Link
              href={`/super-admin/subscriptions/${clinic.id}`}
              className="text-sm font-medium text-slate underline-offset-4 hover:underline"
            >
              Manage subscription
            </Link>
          }
        >
          {clinic.subscription ? (
            <dl className="flex flex-col gap-2">
              <Row label="Plan">{clinic.subscription.planName}</Row>
              <Row label="Status">
                <SubscriptionPill status={clinic.subscription.status} />
              </Row>
              <Row label="Trial ends">
                {formatDate(clinic.subscription.trialEndsAt)}
              </Row>
              <Row label="Period ends">
                {formatDate(clinic.subscription.currentPeriodEnd)}
              </Row>
            </dl>
          ) : (
            <EmptyState>This clinic has no subscription yet.</EmptyState>
          )}
        </SectionCard>

        <SectionCard title="Services">
          {clinic.services.length === 0 ? (
            <EmptyState>No services yet.</EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-divider">
              {clinic.services.map((service) => (
                <li
                  key={service.id}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <span>
                    <span className="font-semibold tabular-nums">
                      {service.tokenPrefix}
                    </span>{" "}
                    · {service.name}
                  </span>
                  <span className="text-muted-foreground">
                    {service.isActive ? "Active" : "Disabled"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Staff">
          {clinic.members.length === 0 ? (
            <EmptyState>No staff yet.</EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-divider">
              {clinic.members.map((member) => (
                <li
                  key={member.userId}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold">{member.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {member.email}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    {ROLE_LABELS[member.role]}
                    {member.status === "ACTIVE"
                      ? ""
                      : ` · ${member.status.toLowerCase()}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}
