import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { MESSAGES_HREF } from "@/components/layout/staff-nav";
import {
  RECEPTION_ROLES,
  requestNow,
  requireStaffPage,
} from "@/components/layout/staff-session";
import { LiveQueue } from "@/components/queue/live-queue";
import { Skeleton } from "@/components/ui/skeleton";
import { getStaffQueueView, getTodayQueues } from "@/features/queue/queries";

const BREADCRUMBS = [
  { label: "Reception", href: "/receptionist" },
  { label: "Live queue" },
];

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
        <PageHeader
          title="Live queue"
          breadcrumbs={BREADCRUMBS}
          status="No queues today"
        />
        <p className="rounded-card border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground shadow-card">
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
        breadcrumbs={BREADCRUMBS}
        status="Press N to call the next patient"
      />
      <LiveQueue
        key={selected.queueId}
        initialView={view}
        queues={queues}
        initialNow={now}
        timezone={context.clinic.timezone}
        messagesHref={MESSAGES_HREF[context.role]}
      />
    </>
  );
}

function LiveQueueSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-5">
      <Skeleton className="h-14 rounded-none" />
      <Skeleton className="h-14 rounded-card" />
      <Skeleton className="h-44 rounded-card" />
      <Skeleton className="h-72 rounded-card" />
      <span className="sr-only">Loading the live queue…</span>
    </div>
  );
}
