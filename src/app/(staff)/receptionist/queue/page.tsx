import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import {
  RECEPTION_ROLES,
  requestNow,
  requireStaffPage,
} from "@/components/layout/staff-session";
import { LiveQueue } from "@/components/queue/live-queue";
import { Skeleton } from "@/components/ui/skeleton";
import { getStaffQueueView, getTodayQueues } from "@/features/queue/queries";

export default function LiveQueuePage({
  searchParams,
}: PageProps<"/receptionist/queue">) {
  return (
    <Suspense fallback={<LiveQueueSkeleton />}>
      <LiveQueueSection searchParams={searchParams} />
    </Suspense>
  );
}

async function LiveQueueSection({
  searchParams,
}: {
  searchParams: PageProps<"/receptionist/queue">["searchParams"];
}) {
  const context = await requireStaffPage(RECEPTION_ROLES);
  const { queue: requested } = await searchParams;
  const queues = await getTodayQueues(context.clinic.id);

  if (queues.length === 0) {
    return (
      <>
        <PageHeader title="Live queue" status="No queues today" />
        <p className="rounded-card border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          There are no queues today. Queues open with the clinic&apos;s hours
          for each active service.
        </p>
      </>
    );
  }

  const selected =
    queues.find((queue) => queue.queueId === requested) ?? queues[0];
  const view = await getStaffQueueView(selected.queueId);
  if (!view) notFound();
  const now = await requestNow();

  return (
    <>
      <PageHeader
        title="Live queue"
        status={`${context.clinic.name} · press N to call the next patient`}
      />
      <LiveQueue
        key={selected.queueId}
        initialView={view}
        queues={queues}
        initialNow={now}
      />
    </>
  );
}

function LiveQueueSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-10 w-full max-w-md" />
      <Skeleton className="h-44 rounded-card" />
      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-14 rounded-[10px]" />
          ))}
        </div>
        <Skeleton className="h-56 rounded-card" />
      </div>
      <span className="sr-only">Loading the live queue…</span>
    </div>
  );
}
