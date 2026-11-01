import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { requireStaffPage } from "@/components/layout/staff-session";
import { StaffMessages } from "@/components/messaging/staff-messages";
import { StaffMessagesSkeleton } from "@/components/messaging/staff-messages-skeleton";

// Clinic admins answer reception chats, and doctor chats when no doctor
// serves the service (docs/MESSAGING.md "Routing").
export default function AdminMessagesPage() {
  return (
    <Suspense fallback={<StaffMessagesSkeleton />}>
      <Messages />
    </Suspense>
  );
}

async function Messages() {
  await requireStaffPage(["CLINIC_ADMIN"]);
  return (
    <>
      <PageHeader
        title="Messages"
        breadcrumbs={[{ label: "Admin" }, { label: "Messages" }]}
      />
      <StaffMessages basePath="/admin/messages" />
    </>
  );
}
