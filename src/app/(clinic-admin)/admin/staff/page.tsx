import { Suspense } from "react";
import { AdminSection } from "@/components/admin/admin-ui";
import { InviteForm } from "@/components/admin/invite-form";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import { StaffManager } from "@/components/admin/staff-manager";
import { PageHeader } from "@/components/layout/page-header";
import { requireStaffPage } from "@/components/layout/staff-session";
import { listPendingInvitations } from "@/features/invitations/invitations";
import { listStaff } from "@/features/staff/staff-admin";

export default function AdminStaffPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton label="Loading staff…" />}>
      <Staff />
    </Suspense>
  );
}

async function Staff() {
  const context = await requireStaffPage(["CLINIC_ADMIN"]);
  const [members, invitations] = await Promise.all([
    listStaff(context.clinic.id),
    listPendingInvitations(context.clinic.id),
  ]);
  const active = members.filter((member) => member.status === "ACTIVE").length;
  return (
    <>
      <PageHeader
        title="Staff"
        status={`${active} with access${invitations.length ? ` · ${invitations.length} invited` : ""}`}
        search={false}
      />
      <div className="flex flex-col gap-3.5">
        <AdminSection
          id="invite"
          title="Invite someone"
          description="They get a link to set their own password. No one else ever sees it."
        >
          <InviteForm clinicId={context.clinic.id} />
        </AdminSection>
        <StaffManager
          clinicId={context.clinic.id}
          members={members}
          invitations={invitations}
        />
      </div>
    </>
  );
}
