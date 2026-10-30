import {
  ActivityIcon,
  ChartColumnIcon,
  ClipboardListIcon,
  ClockIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  ListOrderedIcon,
  QrCodeIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShieldCheckIcon,
  StethoscopeIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import type { NavGroup } from "@/components/shell/types";
import type { MembershipRole } from "@/generated/prisma/enums";

export {
  isActive,
  type NavGroup,
  type NavItem,
} from "@/components/shell/types";

export const PANEL_NAMES: Record<MembershipRole, string> = {
  RECEPTIONIST: "Reception",
  DOCTOR: "Doctor",
  CLINIC_ADMIN: "Clinic admin",
};

export const ROLE_LABELS: Record<MembershipRole, string> = {
  RECEPTIONIST: "Receptionist",
  DOCTOR: "Doctor",
  CLINIC_ADMIN: "Clinic admin",
};

// Where the bell in the top bar leads.
export const ACTIVITY_HREF: Record<MembershipRole, string> = {
  RECEPTIONIST: "/receptionist#activity",
  DOCTOR: "/doctor",
  CLINIC_ADMIN: "/admin/audit",
};

const RECEPTION: NavGroup[] = [
  {
    label: "Main",
    items: [
      {
        href: "/receptionist",
        label: "Dashboard",
        shortLabel: "Overview",
        icon: LayoutDashboardIcon,
        exact: true,
        tab: true,
      },
      {
        href: "/receptionist/queue",
        label: "Live queue",
        shortLabel: "Queue",
        icon: ListOrderedIcon,
        tab: true,
      },
      {
        href: "/receptionist/walk-in",
        label: "Register walk-in",
        shortLabel: "Walk-in",
        icon: UserPlusIcon,
      },
    ],
  },
  {
    label: "Queue",
    items: [
      {
        href: "/receptionist/history",
        label: "Queue history",
        shortLabel: "History",
        icon: HistoryIcon,
        tab: true,
      },
    ],
  },
];

// Routes from docs/PLAN.md §12.8.
const DOCTOR: NavGroup[] = [
  {
    label: "Main",
    items: [
      {
        href: "/doctor",
        label: "Dashboard",
        shortLabel: "Overview",
        icon: LayoutDashboardIcon,
        exact: true,
        tab: true,
      },
      {
        href: "/doctor/queue",
        label: "My queue",
        shortLabel: "Queue",
        icon: ListOrderedIcon,
        tab: true,
      },
      {
        href: "/doctor/consultation",
        label: "Current consultation",
        shortLabel: "Patient",
        icon: StethoscopeIcon,
        tab: true,
      },
    ],
  },
  {
    label: "Records",
    items: [
      {
        href: "/doctor/history",
        label: "Consultation history",
        shortLabel: "History",
        icon: HistoryIcon,
        tab: true,
      },
      {
        href: "/doctor/availability",
        label: "Availability",
        icon: ClockIcon,
      },
    ],
  },
];

const CLINIC_ADMIN: NavGroup[] = [
  {
    label: "Admin",
    items: [
      {
        href: "/admin/dashboard",
        label: "Dashboard",
        shortLabel: "Overview",
        icon: LayoutDashboardIcon,
        tab: true,
      },
      {
        href: "/admin/analytics",
        label: "Analytics and reports",
        shortLabel: "Reports",
        icon: ChartColumnIcon,
      },
      {
        href: "/admin/audit",
        label: "Audit activity",
        shortLabel: "Audit",
        icon: ScrollTextIcon,
      },
    ],
  },
  {
    label: "Clinic setup",
    items: [
      {
        href: "/admin/services",
        label: "Services",
        icon: ClipboardListIcon,
      },
      {
        href: "/admin/doctors",
        label: "Doctors",
        icon: StethoscopeIcon,
      },
      { href: "/admin/staff", label: "Staff", icon: UsersIcon },
      {
        href: "/admin/roles",
        label: "Roles and permissions",
        shortLabel: "Roles",
        icon: ShieldCheckIcon,
      },
      {
        href: "/admin/settings",
        label: "Clinic settings",
        shortLabel: "Settings",
        icon: SettingsIcon,
        tab: true,
      },
      { href: "/admin/qr-code", label: "QR code", icon: QrCodeIcon },
    ],
  },
  {
    label: "Reception",
    items: [
      {
        href: "/receptionist",
        label: "Reception dashboard",
        icon: ActivityIcon,
        exact: true,
      },
      {
        href: "/receptionist/queue",
        label: "Live queue",
        shortLabel: "Queue",
        icon: ListOrderedIcon,
        tab: true,
      },
      {
        href: "/receptionist/walk-in",
        label: "Register walk-in",
        shortLabel: "Walk-in",
        icon: UserPlusIcon,
      },
      {
        href: "/receptionist/history",
        label: "Queue history",
        shortLabel: "History",
        icon: HistoryIcon,
      },
    ],
  },
];

const NAV: Record<MembershipRole, NavGroup[]> = {
  RECEPTIONIST: RECEPTION,
  DOCTOR,
  CLINIC_ADMIN,
};

export function navForRole(role: MembershipRole): NavGroup[] {
  return NAV[role];
}

export const WALK_IN_HREF = "/receptionist/walk-in";
