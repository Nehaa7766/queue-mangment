import type { ReactNode } from "react";
import { AppShellSkeleton } from "@/components/shell/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import type { StaffContext } from "@/lib/auth/staff-context";
import { StaffChrome } from "./staff-chrome";
import { StaffProvider } from "./staff-provider";
import { requestNow } from "./staff-session";

// Staff app shell (docs/GUI_RULES.md §6), shared by every clinic staff panel.
export async function StaffShell({
  context,
  children,
}: {
  context: StaffContext;
  children: ReactNode;
}) {
  // Request time for the date in each page header.
  const now = await requestNow();
  return (
    <StaffProvider value={context}>
      <StaffChrome now={now}>{children}</StaffChrome>
    </StaffProvider>
  );
}

// Static shell shown while the session is read.
export function StaffShellFallback() {
  return (
    <AppShellSkeleton>
      <div aria-busy="true" className="flex flex-col gap-5">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-card" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-card" />
        <span className="sr-only">Loading…</span>
      </div>
    </AppShellSkeleton>
  );
}
