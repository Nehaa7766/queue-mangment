import { Suspense } from "react";
import { DoctorPanelSkeleton } from "@/components/doctor/doctor-skeleton";
import { DoctorConsultation } from "@/components/doctor/doctor-screens";
import { PageHeader } from "@/components/layout/page-header";
import { requireStaffPage } from "@/components/layout/staff-session";
import { getDoctorPanelView } from "@/features/doctor/queries";
import { DOCTOR_ROLES } from "../doctor-roles";

export default function ConsultationPage() {
  return (
    <Suspense
      fallback={<DoctorPanelSkeleton label="Loading the consultation…" />}
    >
      <Consultation />
    </Suspense>
  );
}

async function Consultation() {
  await requireStaffPage(DOCTOR_ROLES);
  const view = await getDoctorPanelView();

  return (
    <>
      <PageHeader
        title="Current consultation"
        search={false}
        status="Name, token and service only. No medical details are recorded."
      />
      <DoctorConsultation initialView={view} />
    </>
  );
}
