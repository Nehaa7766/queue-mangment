import { CheckIcon, MinusIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { AdminSection } from "@/components/admin/admin-ui";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { ROLE_LABELS } from "@/components/layout/staff-nav";
import { requireStaffPage } from "@/components/layout/staff-session";
import { buttonVariants } from "@/components/ui/button";
import { MEMBERSHIP_ROLES } from "@/features/staff/schemas";
import { listStaff } from "@/features/staff/staff-admin";
import { ACTIONS, can, type Action } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

// What each permission in src/lib/auth/permissions.ts lets someone do.
const ACTION_LABELS: Record<Action, string> = {
  "queue.view": "See the live queue",
  "queue.callNext": "Call the next patient",
  "queue.recall": "Recall a patient",
  "queue.skip": "Skip or cancel a token",
  "queue.requeue": "Put a skipped patient back in the queue",
  "queue.pauseResume": "Pause and resume a queue",
  "walkIn.create": "Register walk-ins",
  "consultation.start": "Start a consultation",
  "consultation.complete": "Complete a consultation",
  "doctor.availability": "Set own availability and delays",
  "clinic.settings": "Change clinic settings and hours",
  "services.manage": "Manage services and doctor assignments",
  "staff.manage": "Invite staff and change roles",
  "analytics.view": "See analytics and reports",
  "audit.view": "See the audit log",
};

export default function AdminRolesPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton label="Loading roles…" />}>
      <Roles />
    </Suspense>
  );
}

async function Roles() {
  const context = await requireStaffPage(["CLINIC_ADMIN"]);
  const members = await listStaff(context.clinic.id);
  const active = members.filter((member) => member.status === "ACTIVE");

  return (
    <>
      <PageHeader
        title="Roles and permissions"
        status="Each person has one role at this clinic."
        search={false}
      />
      <div className="flex flex-col gap-3.5">
        <AdminSection
          title="What each role can do"
          description="Roles are fixed so every clinic works the same way. The server checks these on every request."
        >
          <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <table className="w-full min-w-[520px] text-sm">
              <caption className="sr-only">
                Permissions by role. A tick means the role can do it.
              </caption>
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Permission
                  </th>
                  {MEMBERSHIP_ROLES.map((role) => (
                    <th
                      key={role}
                      scope="col"
                      className="w-28 px-2 py-2 text-center font-semibold"
                    >
                      {ROLE_LABELS[role]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {ACTIONS.map((action) => (
                  <tr key={action}>
                    <th
                      scope="row"
                      className="py-2.5 pr-3 text-left font-normal"
                    >
                      {ACTION_LABELS[action]}
                    </th>
                    {MEMBERSHIP_ROLES.map((role) => (
                      <td key={role} className="px-2 py-2.5 text-center">
                        {can(role, action) ? (
                          <>
                            <CheckIcon
                              aria-hidden
                              className="mx-auto size-4 text-status-done-foreground"
                            />
                            <span className="sr-only">Yes</span>
                          </>
                        ) : (
                          <>
                            <MinusIcon
                              aria-hidden
                              className="mx-auto size-4 text-muted-foreground"
                            />
                            <span className="sr-only">No</span>
                          </>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminSection>

        <AdminSection
          title="Who has which role"
          actions={
            <Link
              href="/admin/staff"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-9 rounded-btn",
              )}
            >
              Change roles
            </Link>
          }
        >
          <div className="grid gap-4 md:grid-cols-3">
            {MEMBERSHIP_ROLES.map((role) => {
              const people = active.filter((member) => member.role === role);
              return (
                <div key={role}>
                  <h3 className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                    {ROLE_LABELS[role]} ({people.length})
                  </h3>
                  {people.length === 0 ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Nobody yet.
                    </p>
                  ) : (
                    <ul className="mt-1 flex flex-col gap-1 text-sm">
                      {people.map((member) => (
                        <li key={member.membershipId}>{member.name}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </AdminSection>
      </div>
    </>
  );
}
