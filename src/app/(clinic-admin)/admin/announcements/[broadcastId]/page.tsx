import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { AnnouncementDetailScreen } from "@/components/announcements/announcement-detail";
import { AnnouncementDetailPageSkeleton } from "@/components/announcements/skeletons";
import { requireStaffPage } from "@/components/layout/staff-session";

// Typed by hand rather than with PageProps, so type checks pass before
// `next typegen` has seen the route.
type Params = Promise<{ broadcastId: string }>;

export default function AdminAnnouncementPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<AnnouncementDetailPageSkeleton />}>
      <Announcement params={params} />
    </Suspense>
  );
}

async function Announcement({ params }: { params: Params }) {
  const context = await requireStaffPage(["CLINIC_ADMIN"]);
  const { broadcastId } = await params;
  if (!z.uuid().safeParse(broadcastId).success) notFound();
  return (
    <AnnouncementDetailScreen
      broadcastId={broadcastId}
      basePath="/admin/announcements"
      crumbs={[{ label: "Patients" }]}
      timeZone={context.clinic.timezone}
    />
  );
}
