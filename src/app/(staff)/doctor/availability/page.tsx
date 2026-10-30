import { ClipboardListIcon, MonitorIcon, UsersIcon } from "lucide-react";
import { Suspense, type ReactNode } from "react";
import { AvailabilityForm } from "@/components/doctor/availability-form";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { ListRow } from "@/components/dashboard/list-row";
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

function IconCircle({ children }: { children: ReactNode }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
      {children}
    </span>
  );
}

async function Availability() {
  await requireStaffPage(DOCTOR_ROLES);
  const { doctor, timezone } = await getDoctorAvailability();

  return (
    <>
      <PageHeader
        title="Availability"
        breadcrumbs={[
          { label: "Doctor", href: "/doctor" },
          { label: "Availability" },
        ]}
        status="Tell reception and waiting patients when you're on a break or running late."
      />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <DashboardCard
          title="Your availability"
          description="Changes show on reception's screen straight away."
        >
          <AvailabilityForm initialDoctor={doctor} timezone={timezone} />
        </DashboardCard>
        <DashboardCard
          title="Who sees what"
          description="No patient details are ever shared."
          bodyClassName="py-1"
        >
          <div className="flex flex-col divide-y divide-divider">
            <ListRow
              leading={
                <IconCircle>
                  <MonitorIcon className="size-5" aria-hidden />
                </IconCircle>
              }
              title="Reception"
              subtitle="Your status, any delay and your note."
            />
            <ListRow
              leading={
                <IconCircle>
                  <UsersIcon className="size-5" aria-hidden />
                </IconCircle>
              }
              title="Waiting patients"
              subtitle="Only that the doctor is on a short break or running late — never your name."
            />
            <ListRow
              leading={
                <IconCircle>
                  <ClipboardListIcon className="size-5" aria-hidden />
                </IconCircle>
              }
              title="Clinic admin"
              subtitle="Changes are kept in the clinic's audit log."
            />
          </div>
        </DashboardCard>
      </div>
    </>
  );
}

function AvailabilitySkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-5">
      <Skeleton className="-mx-4 -mt-4 h-16 rounded-none md:-mx-6 md:-mt-6" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-96 rounded-card" />
        <Skeleton className="h-64 rounded-card" />
      </div>
      <span className="sr-only">Loading your availability…</span>
    </div>
  );
}
