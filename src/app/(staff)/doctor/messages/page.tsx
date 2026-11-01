import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { requireStaffPage } from "@/components/layout/staff-session";
import { StaffMessages } from "@/components/messaging/staff-messages";
import { StaffMessagesSkeleton } from "@/components/messaging/staff-messages-skeleton";
import { DOCTOR_ROLES } from "../doctor-roles";

// The doctor's chats: patients of their services before a consultation, and
// their own patients once it starts (docs/MESSAGING.md "Routing").
export default function DoctorMessagesPage() {
  return (
    <Suspense fallback={<StaffMessagesSkeleton />}>
      <Messages />
    </Suspense>
  );
}

async function Messages() {
  await requireStaffPage(DOCTOR_ROLES);
  return (
    <>
      <PageHeader
        title="Messages"
        breadcrumbs={[
          { label: "Doctor", href: "/doctor" },
          { label: "Messages" },
        ]}
      />
      <StaffMessages basePath="/doctor/messages" />
    </>
  );
}
