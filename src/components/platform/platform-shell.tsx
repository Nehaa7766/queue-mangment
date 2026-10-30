import type { ReactNode } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PlatformBottomTabs,
  PlatformIconRail,
  PlatformSidebar,
  PlatformTopBar,
} from "./platform-navigation";
import type { PlatformUser } from "./platform-session";

// Same layout rules as the staff shell (docs/PLAN.md §12.6): sidebar on
// desktop, icon rail on tablet, top bar and bottom tabs on phones.
export function PlatformShell({
  user,
  children,
}: {
  user: PlatformUser;
  children: ReactNode;
}) {
  const signOut = (
    <SignOutButton
      variant="ghost"
      className="h-10 w-full justify-start rounded-btn"
    />
  );
  return (
    <div className="flex min-h-svh flex-col md:pl-[72px] lg:pl-[236px]">
      <PlatformSidebar user={user} accountActions={signOut} />
      <PlatformIconRail />
      <PlatformTopBar />
      <main className="flex flex-1 flex-col px-4 pt-4 pb-28 md:px-[22px] md:py-[22px] lg:px-[26px]">
        {children}
      </main>
      <PlatformBottomTabs user={user} accountActions={signOut} />
    </div>
  );
}

// Static shell shown while the session is read.
export function PlatformShellFallback() {
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
        <Skeleton className="h-64 rounded-card" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

// Page title with an optional description and actions on the right.
export function PlatformPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3 md:mb-5">
      <div className="min-w-0">
        <h1 className="font-display text-[22px] font-bold md:text-[26px]">
          {title}
        </h1>
        {description && (
          <div className="mt-0.5 text-sm text-muted-foreground">
            {description}
          </div>
        )}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </header>
  );
}

// Skeleton for a page's content while its data loads.
export function PlatformPageSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-card" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-card" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
