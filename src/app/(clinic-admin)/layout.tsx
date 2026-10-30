import { Suspense, type ReactNode } from "react";
import {
  StaffShell,
  StaffShellFallback,
} from "@/components/layout/staff-shell";
import { requireStaffPage } from "@/components/layout/staff-session";

// Clinic admin panel: the shared staff shell, for clinic admins only.
// Signed-out visitors go to /login and other roles to /unauthorized; every
// admin API checks the same thing again on the server.
export default function ClinicAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense fallback={<StaffShellFallback />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

async function AdminShell({ children }: { children: ReactNode }) {
  const context = await requireStaffPage(["CLINIC_ADMIN"]);
  return <StaffShell context={context}>{children}</StaffShell>;
}
