import { Suspense } from "react";
import { AnnouncementsScreen } from "@/components/announcements/announcements-screen";
import { AnnouncementsPageSkeleton } from "@/components/announcements/skeletons";
import {
  RECEPTION_ROLES,
  requireStaffPage,
} from "@/components/layout/staff-session";

export default function ReceptionAnnouncementsPage() {
  return (
    <Suspense fallback={<AnnouncementsPageSkeleton />}>
      <Announcements />
    </Suspense>
  );
}

async function Announcements() {
  const context = await requireStaffPage(RECEPTION_ROLES);
  return (
    <AnnouncementsScreen
      basePath="/receptionist/announcements"
      crumbs={[{ label: "Reception", href: "/receptionist" }]}
      timeZone={context.clinic.timezone}
    />
  );
}
