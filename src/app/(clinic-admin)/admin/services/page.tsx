import { Suspense } from "react";
import { ServicesManager } from "@/components/admin/services-manager";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { requireStaffPage } from "@/components/layout/staff-session";
import { listServices } from "@/features/services/service-admin";

export default function AdminServicesPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton label="Loading services…" />}>
      <Services />
    </Suspense>
  );
}

async function Services() {
  const context = await requireStaffPage(["CLINIC_ADMIN"]);
  const services = await listServices(context.clinic.id);
  const active = services.filter((service) => service.isActive).length;
  return (
    <>
      <PageHeader
        title="Services"
        status={`${active} active of ${services.length}`}
        search={false}
      />
      <ServicesManager clinicId={context.clinic.id} services={services} />
    </>
  );
}
