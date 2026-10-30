import { UserPlusIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { DoctorsManager } from "@/components/admin/doctors-manager";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { requireStaffPage } from "@/components/layout/staff-session";
import { buttonVariants } from "@/components/ui/button";
import { listServices } from "@/features/services/service-admin";
import { listStaff } from "@/features/staff/staff-admin";
import { cn } from "@/lib/utils";

export default function AdminDoctorsPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton label="Loading doctors…" />}>
      <Doctors />
    </Suspense>
  );
}

async function Doctors() {
  const context = await requireStaffPage(["CLINIC_ADMIN"]);
  const [members, services] = await Promise.all([
    listStaff(context.clinic.id),
    listServices(context.clinic.id),
  ]);
  const doctors = members.filter((member) => member.role === "DOCTOR");
  return (
    <>
      <PageHeader
        title="Doctors"
        status="Choose which services each doctor serves."
        breadcrumbs={[{ label: "Clinic setup" }, { label: "Doctors" }]}
        actions={
          <Link
            href="/admin/staff#invite"
            className={cn(buttonVariants(), "h-9 rounded-btn font-semibold")}
          >
            <UserPlusIcon aria-hidden />
            Invite a doctor
          </Link>
        }
      />
      <DoctorsManager
        clinicId={context.clinic.id}
        doctors={doctors}
        services={services}
      />
    </>
  );
}
