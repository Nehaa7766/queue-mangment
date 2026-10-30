import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ActivityTable } from "@/components/platform/activity-table";
import { firstParam } from "@/components/platform/filter-chips";
import { Pagination } from "@/components/platform/pagination";
import { PlatformPageSkeleton } from "@/components/platform/platform-shell";
import { requirePlatformPage } from "@/components/platform/platform-session";
import { ListCard, ListCount } from "@/components/platform/section-card";
import { listPlatformActivityPage } from "@/features/platform/activity";
import { PAGE_SIZE, parsePage } from "@/features/platform/pagination";

export const metadata: Metadata = { title: "Activity log · QueueCare" };

export default function ActivityPage({
  searchParams,
}: PageProps<"/super-admin/activity">) {
  return (
    <Suspense fallback={<PlatformPageSkeleton />}>
      <Activity searchParams={searchParams} />
    </Suspense>
  );
}

async function Activity({
  searchParams,
}: {
  searchParams: PageProps<"/super-admin/activity">["searchParams"];
}) {
  await requirePlatformPage();
  const activity = await listPlatformActivityPage({
    page: parsePage(firstParam((await searchParams).page)),
    pageSize: PAGE_SIZE,
  });

  return (
    <>
      <PageHeader
        title="Activity log"
        breadcrumbs={[{ label: "Activity log" }]}
        status="Every platform admin action and self-service sign-up, newest first."
      />
      <ListCard
        toolbar={
          <ListCount count={activity.total} one="action" many="actions" />
        }
      >
        <ActivityTable events={activity.rows} label="Platform activity" />
        <Pagination
          result={activity}
          href={(page) => `/super-admin/activity?page=${page}`}
        />
      </ListCard>
    </>
  );
}
