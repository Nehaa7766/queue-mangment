import { Suspense } from "react";
import { AnnouncementsScreen } from "@/components/announcements/announcements-screen";
import { AnnouncementsPageSkeleton } from "@/components/announcements/skeletons";
import { requireStaffPage } from "@/components/layout/staff-session";

export default function AdminAnnouncementsPage() {
  return (
    <Suspense fallback={<AnnouncementsPageSkeleton />}>
      <Announcements />
    </Suspense>
  );
}

async function Announcements() {
  const context = await requireStaffPage(["CLINIC_ADMIN"]);
  return (
    <AnnouncementsScreen
      basePath="/admin/announcements"
      crumbs={[{ label: "Patients" }]}
      timeZone={context.clinic.timezone}
    />
  );
}
