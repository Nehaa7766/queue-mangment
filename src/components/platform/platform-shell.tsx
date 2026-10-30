import type { ReactNode } from "react";
import { requestNow } from "@/components/layout/staff-session";
import { AppShellSkeleton } from "@/components/shell/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformChrome } from "./platform-chrome";
import type { PlatformUser } from "./platform-session";

// Platform super-admin shell: the same app shell as the clinic panels
// (docs/GUI_RULES.md §6), with the platform menu.
export async function PlatformShell({
  user,
  children,
}: {
  user: PlatformUser;
  children: ReactNode;
}) {
  // Request time for the date in each page header. Never prerendered.
  const now = await requestNow();
  return (
    <PlatformChrome user={user} now={now}>
      {children}
    </PlatformChrome>
  );
}

// Static shell shown while the session is read.
export function PlatformShellFallback() {
  return (
    <AppShellSkeleton>
      <PlatformPageSkeleton />
    </AppShellSkeleton>
  );
}

// Skeleton for a page's content while its data loads.
export function PlatformPageSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-card" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-card" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
