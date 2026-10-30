import {
  Building2Icon,
  ChartColumnIcon,
  CreditCardIcon,
  LayoutDashboardIcon,
  LifeBuoyIcon,
  ScrollTextIcon,
  SettingsIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

export type PlatformNavItem = {
  href: string;
  label: string;
  // Bottom tab bar label, when shorter than `label`.
  shortLabel?: string;
  icon: LucideIcon;
  // Shown in the phone bottom tab bar. Keep to four.
  tab?: boolean;
};

export type PlatformNavGroup = { label: string; items: PlatformNavItem[] };

// Routes from docs/PLAN.md §12.8 (platform super admin).
export const PLATFORM_NAV: PlatformNavGroup[] = [
  {
    label: "Main",
    items: [
      {
        href: "/super-admin/dashboard",
        label: "Dashboard",
        shortLabel: "Overview",
        icon: LayoutDashboardIcon,
        tab: true,
      },
      {
        href: "/super-admin/clinics",
        label: "Clinics",
        icon: Building2Icon,
        tab: true,
      },
      { href: "/super-admin/users", label: "Users", icon: UsersIcon },
    ],
  },
  {
    label: "Billing",
    items: [
      {
        href: "/super-admin/subscriptions",
        label: "Plans and subscriptions",
        shortLabel: "Plans",
        icon: CreditCardIcon,
        tab: true,
      },
      {
        href: "/super-admin/billing",
        label: "Billing overview",
        icon: ChartColumnIcon,
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        href: "/super-admin/support",
        label: "Support",
        icon: LifeBuoyIcon,
        tab: true,
      },
      {
        href: "/super-admin/activity",
        label: "Activity log",
        icon: ScrollTextIcon,
      },
      {
        href: "/super-admin/settings",
        label: "Platform settings",
        icon: SettingsIcon,
      },
    ],
  },
];

export function isPlatformNavActive(
  item: PlatformNavItem,
  pathname: string,
): boolean {
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
