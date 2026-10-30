import { EyeIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import {
  AddClinicButton,
  DeleteClinicButton,
  EditClinicButton,
} from "@/components/platform/clinic-forms";
import { ClinicAvatar } from "@/components/platform/clinic-avatar";
import { DataTable, HeaderRow, TD, TR } from "@/components/platform/data-table";
import {
  FilterChips,
  SearchForm,
  firstParam,
} from "@/components/platform/filter-chips";
import { IconLink, RowActions } from "@/components/platform/icon-action";
import { Pagination } from "@/components/platform/pagination";
import { LifecyclePill, formatDate } from "@/components/platform/pills";
import { PlatformPageSkeleton } from "@/components/platform/platform-shell";
import { requirePlatformPage } from "@/components/platform/platform-session";
import {
  EmptyState,
  ListCard,
  ListCount,
} from "@/components/platform/section-card";
import { CLINIC_TYPE_LABELS } from "@/features/clinics/profile-fields";
import { listClinicsPage } from "@/features/platform/clinics";
import { LIFECYCLE_LABELS } from "@/features/platform/lifecycle";
import { PAGE_SIZE, parsePage } from "@/features/platform/pagination";
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
  const result = await listClinicsPage({
    search,
    lifecycle: status,
    page: parsePage(firstParam(params.page)),
    pageSize: PAGE_SIZE,
  });
  const clinics = result.rows;

  // Filter links start again at page 1; the pager keeps the filters.
  const href = (next: ClinicFilter | undefined, page = 1) => {
    const query = new URLSearchParams();
    if (next) query.set("status", next);
    if (search) query.set("q", search);
    if (page > 1) query.set("page", String(page));
    const text = query.toString();
    return text ? `/super-admin/clinics?${text}` : "/super-admin/clinics";
  };

  return (
    <>
      <PageHeader
        title="Clinics"
        breadcrumbs={[{ label: "Clinics" }]}
        actions={<AddClinicButton />}
      />
      <ListCard
        toolbar={
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
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
              <ListCount count={result.total} one="clinic" many="clinics" />
            </div>
            <SearchForm
              action="/super-admin/clinics"
              label="Search clinics"
              placeholder="Name or address"
              defaultValue={search}
              hidden={{ status }}
            />
          </>
        }
      >
        {clinics.length === 0 ? (
          <EmptyState className="m-5">
            {search || status
              ? "No clinics match these filters."
              : "No clinics yet. Add the first one."}
          </EmptyState>
        ) : (
          <DataTable label="Clinics" minWidth={860}>
            <HeaderRow
              columns={[
                { label: "Clinic" },
                { label: "City" },
                { label: "Status" },
                { label: "Staff", align: "right" },
                { label: "Since" },
                { label: "Actions", srOnly: true },
              ]}
            />
            <tbody>
              {clinics.map((clinic) => (
                <tr key={clinic.id} className={TR}>
                  <td className={TD}>
                    <div className="flex items-center gap-3">
                      <ClinicAvatar
                        name={clinic.name}
                        logoUrl={clinic.logoUrl}
                      />
                      <div className="min-w-0">
                        <Link
                          href={`/super-admin/clinics/${clinic.id}`}
                          className="block truncate font-semibold underline-offset-4 hover:underline"
                        >
                          {clinic.name}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">
                          {CLINIC_TYPE_LABELS[clinic.clinicType]} · /q/
                          {clinic.slug}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td
                    className={`${TD} whitespace-nowrap text-muted-foreground`}
                  >
                    {clinic.city ?? "—"}
                  </td>
                  <td className={TD}>
                    <LifecyclePill lifecycle={clinic.lifecycle} />
                  </td>
                  <td className={`${TD} text-right tabular-nums`}>
                    {clinic.memberCount}
                  </td>
                  <td
                    className={`${TD} whitespace-nowrap text-muted-foreground`}
                  >
                    {formatDate(clinic.createdAt)}
                  </td>
                  <td className={TD}>
                    <RowActions>
                      <IconLink
                        href={`/super-admin/clinics/${clinic.id}`}
                        label={`View ${clinic.name}`}
                        tip="View"
                      >
                        <EyeIcon aria-hidden />
                      </IconLink>
                      <EditClinicButton clinic={clinic} compact />
                      <DeleteClinicButton clinic={clinic} compact />
                    </RowActions>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
        <Pagination result={result} href={(page) => href(status, page)} />
      </ListCard>
    </>
  );
}
