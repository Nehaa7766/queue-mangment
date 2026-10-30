"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AppDrawer, AppSidebar, type ShellBrand } from "./app-sidebar";
import { AppTopBar, type TopBarProps } from "./app-top-bar";
import { ShellProvider, useShellUi, type ShellInfo } from "./shell-context";
import type { NavGroup } from "./types";

type AppShellProps = {
  info: ShellInfo;
  groups: NavGroup[];
  brand: ShellBrand;
  sidebarFooter?: ReactNode;
  topBar: TopBarProps;
  // Phone bottom tabs; adds room at the bottom of the page below md.
  bottomNav?: ReactNode;
  children: ReactNode;
};

// Layout every signed-in panel shares (docs/GUI_RULES.md §6): white sidebar
// on desktop, white top bar everywhere, menu drawer below lg, and the page on
// a light grey background so white cards stand out.
export function AppShell({ info, ...props }: AppShellProps) {
  return (
    <ShellProvider info={info}>
      <ShellFrame {...props} />
    </ShellProvider>
  );
}

function ShellFrame({
  groups,
  brand,
  sidebarFooter,
  topBar,
  bottomNav,
  children,
}: Omit<AppShellProps, "info">) {
  const { collapsed } = useShellUi();
  return (
    <div
      className={cn(
        "flex min-h-svh flex-col bg-background transition-[padding] duration-200",
        collapsed ? "lg:pl-[76px]" : "lg:pl-[256px]",
      )}
    >
      <AppSidebar groups={groups} brand={brand} footer={sidebarFooter} />
      <AppDrawer groups={groups} brand={brand} footer={sidebarFooter} />
      <AppTopBar {...topBar} />
      <main
        className={cn(
          "flex flex-1 flex-col px-4 py-4 md:px-6 md:py-6",
          bottomNav && "pb-28 md:pb-6",
        )}
      >
        {children}
      </main>
      {bottomNav}
    </div>
  );
}

// Static stand-in while the session is read: same frame, no data.
export function AppShellSkeleton({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background lg:pl-[256px]">
      <div className="fixed inset-y-0 left-0 hidden w-[256px] border-r border-border bg-card lg:block" />
      <div className="h-16 border-b border-border bg-card" />
      <div className="flex flex-col gap-5 px-4 py-4 md:px-6 md:py-6">
        {children}
      </div>
    </div>
  );
}
