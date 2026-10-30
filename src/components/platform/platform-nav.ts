import {
  Building2Icon,
  LayoutDashboardIcon,
  LifeBuoyIcon,
  ScrollTextIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react";
import type { NavGroup } from "@/components/shell/types";

// Routes from docs/PLAN.md §12.8 (platform super admin).
export const PLATFORM_NAV: NavGroup[] = [
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
      {
        href: "/super-admin/users",
        label: "Users",
        icon: UsersIcon,
        tab: true,
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
