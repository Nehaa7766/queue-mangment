import { Suspense } from "react";
import { AvailabilityForm } from "@/components/doctor/availability-form";
import { PageHeader } from "@/components/layout/page-header";
import { requireStaffPage } from "@/components/layout/staff-session";
import { Skeleton } from "@/components/ui/skeleton";
import { getDoctorAvailability } from "@/features/doctor/queries";
import { DOCTOR_ROLES } from "../doctor-roles";

export default function AvailabilityPage() {
  return (
    <Suspense fallback={<AvailabilitySkeleton />}>
      <Availability />
    </Suspense>
  );
}

async function Availability() {
  await requireStaffPage(DOCTOR_ROLES);
  const { doctor, timezone } = await getDoctorAvailability();

  return (
    <>
      <PageHeader
        title="Availability"
        search={false}
        status="Reception sees your status and note. Waiting patients only see that you're on a break or running late."
      />
      <div className="max-w-2xl rounded-card border border-border bg-card p-5">
        <AvailabilityForm initialDoctor={doctor} timezone={timezone} />
      </div>
    </>
  );
}

function AvailabilitySkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-80 max-w-2xl rounded-card" />
      <span className="sr-only">Loading your availability…</span>
    </div>
  );
}
