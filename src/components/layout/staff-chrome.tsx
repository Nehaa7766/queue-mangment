"use client";

import type { ReactNode } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { AppShell } from "@/components/shell/app-shell";
import { HelpCard } from "@/components/shell/help-card";
import { homePathFor } from "@/lib/auth/home";
import { ACTIVITY_HREF, navForRole, WALK_IN_HREF } from "./staff-nav";
import { AccountMenu, BottomTabs } from "./staff-navigation";
import { useStaff } from "./staff-provider";

// The shared app shell, filled in for the signed-in clinic staff member.
// A client component because the nav carries icon components.
export function StaffChrome({
  now,
  children,
}: {
  now: number;
  children: ReactNode;
}) {
  const { role, clinic } = useStaff();
  const reception = role !== "DOCTOR";
  const signOut = (
    <SignOutButton
      variant="ghost"
      className="h-10 w-full justify-start rounded-btn"
    />
  );
  return (
    <AppShell
      info={{
        homeHref: homePathFor({ platformRole: null, role }),
        now,
        timezone: clinic.timezone,
      }}
      groups={navForRole(role)}
      brand={{ subtitle: clinic.name }}
      sidebarFooter={<HelpCard />}
      topBar={{
        quickAction: reception
          ? { href: WALK_IN_HREF, label: "New walk-in" }
          : undefined,
        search: reception
          ? {
              action: "/receptionist/history",
              label: "Search today's tokens",
              placeholder: "Search token or name",
            }
          : undefined,
        activityHref: ACTIVITY_HREF[role],
        account: <AccountMenu variant="header" accountActions={signOut} />,
      }}
      bottomNav={<BottomTabs accountActions={signOut} />}
    >
      {children}
    </AppShell>
  );
}
