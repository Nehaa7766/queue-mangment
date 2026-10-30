import { Suspense } from "react";
import { AvailabilityBadge } from "@/components/doctor/availability-badge";
import { DoctorPanelSkeleton } from "@/components/doctor/doctor-skeleton";
import { DoctorDashboard } from "@/components/doctor/doctor-screens";
import { PageHeader } from "@/components/layout/page-header";
import { requireStaffPage } from "@/components/layout/staff-session";
import { getDoctorPanelView } from "@/features/doctor/queries";
import { DOCTOR_ROLES } from "./doctor-roles";

export default function DoctorDashboardPage() {
  return (
    <Suspense
      fallback={<DoctorPanelSkeleton label="Loading your dashboard…" />}
    >
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  await requireStaffPage(DOCTOR_ROLES);
  const view = await getDoctorPanelView();

  return (
    <>
      <PageHeader
        title="Dashboard"
        breadcrumbs={[{ label: "Doctor" }, { label: "Dashboard" }]}
        status={
          <span className="inline-flex flex-wrap items-center gap-2">
            <AvailabilityBadge doctor={view.doctor} />
            <span>{view.doctor.name}</span>
          </span>
        }
      />
      <DoctorDashboard initialView={view} />
    </>
  );
}
