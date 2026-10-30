import type { ReactNode } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Skeleton } from "@/components/ui/skeleton";
import type { StaffContext } from "@/lib/auth/staff-context";
import {
  BottomTabs,
  IconRail,
  MobileTopBar,
  Sidebar,
} from "./staff-navigation";
import { StaffProvider } from "./staff-provider";

// Staff app shell (docs/PLAN.md §12.6): sidebar on desktop, icon rail on
// tablet, top bar and bottom tabs on phones. Shared by every staff panel.
export function StaffShell({
  context,
  children,
}: {
  context: StaffContext;
  children: ReactNode;
}) {
  const signOut = (
    <SignOutButton
      variant="ghost"
      className="h-10 w-full justify-start rounded-btn"
    />
  );
  return (
    <StaffProvider value={context}>
      <div className="flex min-h-svh flex-col md:pl-[72px] lg:pl-[236px]">
        <Sidebar accountActions={signOut} />
        <IconRail />
        <MobileTopBar />
        <main className="flex flex-1 flex-col px-4 pt-4 pb-28 md:px-[22px] md:py-[22px] lg:px-[26px]">
          {children}
        </main>
        <BottomTabs accountActions={signOut} />
      </div>
    </StaffProvider>
  );
}

// Static shell shown while the session is read.
export function StaffShellFallback() {
  return (
    <div
      className="flex min-h-svh flex-col md:pl-[72px] lg:pl-[236px]"
      aria-busy="true"
    >
      <div className="fixed inset-y-0 left-0 hidden w-[72px] bg-slate md:block lg:w-[236px] lg:border-r lg:border-border lg:bg-card" />
      <div className="h-14 bg-slate md:hidden" />
      <div className="flex flex-col gap-4 px-4 py-4 md:px-[22px] md:py-[22px] lg:px-[26px]">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-card" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-card" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
