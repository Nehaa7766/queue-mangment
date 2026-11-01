import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import {
  RECEPTION_ROLES,
  requireStaffPage,
} from "@/components/layout/staff-session";
import { StaffMessages } from "@/components/messaging/staff-messages";
import { StaffMessagesSkeleton } from "@/components/messaging/staff-messages-skeleton";

// Private chats with patients (docs/MESSAGING.md "Screens"). Everything on
// the page loads in the browser and stays live through the staff stream.
export default function ReceptionMessagesPage() {
  return (
    <Suspense fallback={<StaffMessagesSkeleton />}>
      <Messages />
    </Suspense>
  );
}

async function Messages() {
  await requireStaffPage(RECEPTION_ROLES);
  return (
    <>
      <PageHeader
        title="Messages"
        breadcrumbs={[
          { label: "Reception", href: "/receptionist" },
          { label: "Messages" },
        ]}
      />
      <StaffMessages basePath="/receptionist/messages" />
    </>
  );
}
