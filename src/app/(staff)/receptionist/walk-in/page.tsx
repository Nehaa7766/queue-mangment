import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import {
  RECEPTION_ROLES,
  requireStaffPage,
} from "@/components/layout/staff-session";
import { Skeleton } from "@/components/ui/skeleton";
import { getTodayQueues } from "@/features/queue/queries";
import { WalkInPanel } from "./walk-in-panel";

export default function WalkInPage() {
  return (
    <Suspense fallback={<WalkInSkeleton />}>
      <WalkIn />
    </Suspense>
  );
}

async function WalkIn() {
  const context = await requireStaffPage(RECEPTION_ROLES);
  const queues = await getTodayQueues(context.clinic.id);
  return (
    <>
      <PageHeader
        title="Register walk-in"
        breadcrumbs={[
          { label: "Reception", href: "/receptionist" },
          { label: "Register walk-in" },
        ]}
        status="Add a patient who is at the desk"
      />
      <WalkInPanel queues={queues} />
    </>
  );
}

function WalkInSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-5">
      <Skeleton className="h-14 rounded-none" />
      <Skeleton className="h-72 rounded-card" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
