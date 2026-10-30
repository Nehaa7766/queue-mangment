import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import {
  FilterChips,
  SearchForm,
  firstParam,
} from "@/components/platform/filter-chips";
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
import { EmptyState } from "@/components/platform/section-card";
import { listClinics } from "@/features/platform/clinics";
import { LIFECYCLE_LABELS } from "@/features/platform/lifecycle";
import { CLINIC_FILTERS, type ClinicFilter } from "@/features/platform/schemas";

export const metadata: Metadata = { title: "Clinics · QueueCare" };

type SearchParams = PageProps<"/super-admin/clinics">["searchParams"];

export default function ClinicsPage({
  searchParams,
}: PageProps<"/super-admin/clinics">) {
  return (
    <Suspense fallback={<PlatformPageSkeleton />}>
      <Clinics searchParams={searchParams} />
    </Suspense>
  );
}

async function Clinics({ searchParams }: { searchParams: SearchParams }) {
  await requirePlatformPage();
  const params = await searchParams;
  const lifecycle = z.enum(CLINIC_FILTERS).safeParse(firstParam(params.status));
  const status: ClinicFilter | undefined = lifecycle.success
    ? lifecycle.data
    : undefined;
  const search = firstParam(params.q)?.trim().slice(0, 80) || undefined;
  const clinics = await listClinics({ search, lifecycle: status });

  const href = (next: ClinicFilter | undefined) => {
    const query = new URLSearchParams();
    if (next) query.set("status", next);
    if (search) query.set("q", search);
    const text = query.toString();
    return text ? `/super-admin/clinics?${text}` : "/super-admin/clinics";
  };

  return (
    <>
      <PlatformPageHeader
        title="Clinics"
        description={`${clinics.length} ${clinics.length === 1 ? "clinic" : "clinics"}`}
      />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <FilterChips
          label="Filter by status"
          chips={[
            { label: "All", href: href(undefined), active: !status },
            ...CLINIC_FILTERS.map((filter) => ({
              label: LIFECYCLE_LABELS[filter],
              href: href(filter),
              active: status === filter,
            })),
          ]}
        />
        <SearchForm
          action="/super-admin/clinics"
          label="Search clinics"
          placeholder="Name or address"
          defaultValue={search}
          hidden={{ status }}
        />
      </div>

      {clinics.length === 0 ? (
        <EmptyState>No clinics match these filters.</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y divide-divider rounded-card border border-border bg-card">
          {clinics.map((clinic) => (
            <li
              key={clinic.id}
              className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0">
                <Link
                  href={`/super-admin/clinics/${clinic.id}`}
                  className="font-semibold underline-offset-4 hover:underline"
                >
                  {clinic.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  /q/{clinic.slug} · {clinic.memberCount}{" "}
                  {clinic.memberCount === 1 ? "staff member" : "staff members"}{" "}
                  · since {formatDate(clinic.createdAt)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <LifecyclePill lifecycle={clinic.lifecycle} />
                {clinic.subscription ? (
                  <>
                    <span className="text-sm text-muted-foreground">
                      {clinic.subscription.planName}
                    </span>
                    <SubscriptionPill status={clinic.subscription.status} />
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    No subscription
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
