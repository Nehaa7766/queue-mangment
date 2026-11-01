"use client";

import { ChevronsLeftIcon, ChevronsRightIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { BrandMark, BrandName } from "@/components/layout/brand-mark";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useShellUi } from "./shell-context";
import { badgeText, isActive, type NavGroup } from "./types";

export const FOCUS =
  "outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export type ShellBrand = { subtitle: string };

// Always at the very bottom of the menu, in every panel.
function SidebarSignOut({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div
      className={cn(
        "shrink-0 border-t border-sidebar-border py-3",
        collapsed ? "px-3" : "px-4",
      )}
    >
      <SignOutButton
        variant="ghost"
        iconOnly={collapsed}
        className={cn(
          "h-10 w-full rounded-btn text-sidebar-foreground hover:bg-status-miss hover:text-status-miss-foreground",
          collapsed ? "justify-center px-0" : "justify-start gap-3 px-3",
        )}
      />
    </div>
  );
}

function BrandText({ brand }: { brand: ShellBrand }) {
  return (
    <div className="flex min-w-0 flex-col leading-tight">
      <BrandName />
      <span className="truncate text-xs text-muted-foreground">
        {brand.subtitle}
      </span>
    </div>
  );
}

// Grouped links with uppercase section labels. Collapsed, only icons show
// and each label stays available to screen readers and as a tooltip.
function NavList({
  groups,
  collapsed = false,
  onNavigate,
}: {
  groups: NavGroup[];
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          {collapsed ? (
            <span aria-hidden className="mx-auto mb-1 h-px w-6 bg-border" />
          ) : (
            <p className="px-3 pb-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              {group.label}
            </p>
          )}
          {group.items.map((item) => {
            const active = isActive(item, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                title={collapsed ? item.label : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-10 items-center gap-3 rounded-btn text-sm font-medium transition-colors",
                  FOCUS,
                  collapsed ? "justify-center" : "px-3",
                  active
                    ? "bg-brand-tint font-semibold text-brand"
                    : "text-sidebar-foreground hover:bg-accent hover:text-foreground",
                  // Mocha marker on the sidebar edge for the open page.
                  active &&
                    !collapsed &&
                    "before:absolute before:inset-y-2 before:-left-4 before:w-[3px] before:rounded-r-full before:bg-brand",
                )}
              >
                <item.icon className="size-[18px] shrink-0" aria-hidden />
                <span className={collapsed ? "sr-only" : undefined}>
                  {item.label}
                </span>
                {item.badge && item.badge.count > 0 && (
                  <>
                    <span
                      aria-hidden
                      className={cn(
                        "rounded-full bg-brand px-1.5 text-center text-[11px] leading-5 font-semibold text-white tabular-nums",
                        collapsed
                          ? "absolute top-0 right-0.5 min-w-5"
                          : "ml-auto min-w-6",
                      )}
                    >
                      {badgeText(item.badge.count)}
                    </span>
                    <span className="sr-only">, {item.badge.label}</span>
                  </>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

// Desktop (lg+): white sidebar, 256px or a 76px icon rail when collapsed.
export function AppSidebar({
  groups,
  brand,
  footer,
}: {
  groups: NavGroup[];
  brand: ShellBrand;
  footer?: ReactNode;
}) {
  const { collapsed, toggleCollapsed } = useShellUi();
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex",
        collapsed ? "w-[76px]" : "w-[256px]",
      )}
    >
      {/* Round handle on the sidebar's edge; the top bar's menu button does the same. */}
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={cn(
          "absolute top-5 -right-3 z-10 flex size-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-card transition-colors hover:border-brand hover:text-brand",
          FOCUS,
        )}
      >
        {collapsed ? (
          <ChevronsRightIcon className="size-3.5" aria-hidden />
        ) : (
          <ChevronsLeftIcon className="size-3.5" aria-hidden />
        )}
      </button>
      <div
        className={cn(
          "flex h-16 shrink-0 items-center gap-2.5 border-b border-sidebar-border",
          collapsed ? "justify-center" : "px-5",
        )}
      >
        <BrandMark />
        {!collapsed && <BrandText brand={brand} />}
      </div>
      {/* Menu and help card scroll together, so a long menu on a short
          screen is never cut off; the card still sits at the bottom when
          there's room. Sign out stays pinned below. */}
      <div
        className={cn(
          "flex flex-1 flex-col overflow-y-auto py-5",
          collapsed ? "px-3" : "px-4",
        )}
      >
        <NavList groups={groups} collapsed={collapsed} />
        {footer && !collapsed && <div className="mt-auto pt-6">{footer}</div>}
      </div>
      <SidebarSignOut collapsed={collapsed} />
    </aside>
  );
}

// Below lg: the same menu in a drawer, opened from the top bar.
export function AppDrawer({
  groups,
  brand,
  footer,
}: {
  groups: NavGroup[];
  brand: ShellBrand;
  footer?: ReactNode;
}) {
  const { drawerOpen, setDrawerOpen } = useShellUi();
  return (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <SheetContent side="left" className="w-[280px] gap-0 p-0 lg:hidden">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-5">
          <BrandMark />
          <BrandText brand={brand} />
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto px-4 py-5">
          <NavList groups={groups} onNavigate={() => setDrawerOpen(false)} />
          {footer && <div className="mt-auto pt-6">{footer}</div>}
        </div>
        <SidebarSignOut />
      </SheetContent>
    </Sheet>
  );
}
