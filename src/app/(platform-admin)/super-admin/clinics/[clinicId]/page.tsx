import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ROLE_LABELS } from "@/components/layout/staff-nav";
import { ClinicAvatar } from "@/components/platform/clinic-avatar";
import {
  DeleteClinicButton,
  EditClinicButton,
} from "@/components/platform/clinic-forms";
import { ClinicStatusButton } from "@/components/platform/clinic-status-button";
import { LifecyclePill, formatDate } from "@/components/platform/pills";
import { PlatformPageSkeleton } from "@/components/platform/platform-shell";
import { requirePlatformPage } from "@/components/platform/platform-session";
import {
  DetailList,
  DetailRow,
  EmptyState,
  SectionCard,
} from "@/components/platform/section-card";
import { AddAdminButton } from "@/components/platform/user-forms";
import { CLINIC_TYPE_LABELS } from "@/features/clinics/profile-fields";
import { hoursSummary } from "@/features/platform/clinic-hours";
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

async function ClinicDetail({ params }: { params: Params }) {
  await requirePlatformPage();
  const clinic = await getClinicDetail((await params).clinicId);
  if (!clinic) notFound();

  return (
    <>
      <PageHeader
        title={clinic.name}
        breadcrumbs={[
          { label: "Clinics", href: "/super-admin/clinics" },
          { label: clinic.name },
        ]}
        status={<LifecyclePill lifecycle={clinic.lifecycle} />}
        actions={
          <>
            <EditClinicButton clinic={clinic} />
            <ClinicStatusButton
              clinicId={clinic.id}
              clinicName={clinic.name}
              lifecycle={clinic.lifecycle}
            />
            <DeleteClinicButton
              clinic={clinic}
              redirectTo="/super-admin/clinics"
            />
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Details" bodyClassName="py-2">
          <DetailList>
            <DetailRow label="Logo">
              <ClinicAvatar
                name={clinic.name}
                logoUrl={clinic.logoUrl}
                size={48}
              />
            </DetailRow>
            <DetailRow label="Type">
              {CLINIC_TYPE_LABELS[clinic.clinicType]}
            </DetailRow>
            <DetailRow label="Public page">
              {clinic.status === "ACTIVE" ? (
                <Link
                  href={`/q/${clinic.slug}`}
                  className="text-brand underline-offset-4 hover:underline"
                >
                  /q/{clinic.slug}
                </Link>
              ) : (
                <span>/q/{clinic.slug} (offline until active)</span>
              )}
            </DetailRow>
            <DetailRow label="Hours">{hoursSummary(clinic.hours)}</DetailRow>
            <DetailRow label="Time zone">{clinic.timezone}</DetailRow>
            <DetailRow label="Created">
              {formatDate(clinic.createdAt)}
            </DetailRow>
          </DetailList>
        </SectionCard>

        <SectionCard title="Contact and location" bodyClassName="py-2">
          <DetailList>
            <DetailRow label="Email">
              {clinic.email ? (
                <a
                  href={`mailto:${clinic.email}`}
                  className="text-brand underline-offset-4 hover:underline"
                >
                  {clinic.email}
                </a>
              ) : (
                "—"
              )}
            </DetailRow>
            <DetailRow label="Phone">{clinic.phone ?? "—"}</DetailRow>
            <DetailRow label="Address">{clinic.address ?? "—"}</DetailRow>
            <DetailRow label="City">{clinic.city ?? "—"}</DetailRow>
            <DetailRow label="State">{clinic.state ?? "—"}</DetailRow>
            <DetailRow label="PIN code">{clinic.pinCode ?? "—"}</DetailRow>
          </DetailList>
        </SectionCard>

        <SectionCard
          title="Services"
          description={`${clinic.services.length} ${clinic.services.length === 1 ? "service" : "services"}`}
          bodyClassName="py-1"
        >
          {clinic.services.length === 0 ? (
            <EmptyState className="my-3">No services yet.</EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-divider">
              {clinic.services.map((service) => (
                <li
                  key={service.id}
                  className="flex items-center justify-between gap-3 py-3 text-sm"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-8 min-w-10 items-center justify-center rounded-btn bg-brand-tint px-2 font-display text-sm font-extrabold text-brand tabular-nums">
                      {service.tokenPrefix}
                    </span>
                    <span className="font-medium">{service.name}</span>
                  </span>
                  <span
                    className={
                      service.isActive
                        ? "text-status-done-foreground"
                        : "text-muted-foreground"
                    }
                  >
                    {service.isActive ? "Active" : "Disabled"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Staff"
          description={`${clinic.members.length} ${clinic.members.length === 1 ? "member" : "members"}`}
          action={
            <AddAdminButton
              clinics={[{ id: clinic.id, name: clinic.name }]}
              clinicId={clinic.id}
            />
          }
          bodyClassName="py-1"
        >
          {clinic.members.length === 0 ? (
            <EmptyState className="my-3">No staff yet.</EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-divider">
              {clinic.members.map((member) => (
                <li
                  key={member.userId}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
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
