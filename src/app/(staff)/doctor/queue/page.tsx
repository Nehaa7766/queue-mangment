import { Suspense } from "react";
import { DoctorPanelSkeleton } from "@/components/doctor/doctor-skeleton";
import { DoctorQueueBoard } from "@/components/doctor/doctor-screens";
import { PageHeader } from "@/components/layout/page-header";
import { requireStaffPage } from "@/components/layout/staff-session";
import { getDoctorPanelView } from "@/features/doctor/queries";
import { DOCTOR_ROLES } from "../doctor-roles";

export default function DoctorQueuePage() {
  return (
    <Suspense fallback={<DoctorPanelSkeleton label="Loading your queue…" />}>
      <Queue />
    </Suspense>
  );
}

async function Queue() {
  await requireStaffPage(DOCTOR_ROLES);
  const view = await getDoctorPanelView();

  return (
    <>
      <PageHeader
        title="My queue"
        breadcrumbs={[
          { label: "Doctor", href: "/doctor" },
          { label: "My queue" },
        ]}
        status={view.clinic.name}
      />
      <DoctorQueueBoard initialView={view} />
    </>
  );
}
