"use client";

import type { ReactNode } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { AppShell } from "@/components/shell/app-shell";
import { PLATFORM_TIMEZONE } from "@/features/platform/analytics-shape";
import { PLATFORM_ADMIN_HOME } from "@/lib/auth/home";
import { PLATFORM_NAV } from "./platform-nav";
import { PlatformAccountMenu, PlatformBottomTabs } from "./platform-navigation";
import type { PlatformUser } from "./platform-session";

// The shared app shell, filled in for a platform super admin. A client
// component because the nav carries icon components.
export function PlatformChrome({
  user,
  now,
  children,
}: {
  user: PlatformUser;
  now: number;
  children: ReactNode;
}) {
  const signOut = (
    <SignOutButton
      variant="ghost"
      className="h-10 w-full justify-start rounded-btn"
    />
  );
  return (
    <AppShell
      info={{ homeHref: PLATFORM_ADMIN_HOME, now, timezone: PLATFORM_TIMEZONE }}
      groups={PLATFORM_NAV}
      brand={{ subtitle: "Platform admin" }}
      topBar={{
        search: {
          action: "/super-admin/clinics",
          label: "Find a clinic",
          placeholder: "Search clinics",
        },
        activityHref: "/super-admin/activity",
        account: <PlatformAccountMenu user={user} accountActions={signOut} />,
      }}
      bottomNav={<PlatformBottomTabs user={user} accountActions={signOut} />}
    >
      {children}
    </AppShell>
  );
}
