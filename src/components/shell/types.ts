import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  // Bottom tab bar label, when shorter than `label`.
  shortLabel?: string;
  icon: LucideIcon;
  // Active only on this exact path, not on paths below it.
  exact?: boolean;
  // Shown in the phone bottom tab bar. Keep to four per panel.
  tab?: boolean;
};

export type NavGroup = { label: string; items: NavItem[] };

export function isActive(item: NavItem, pathname: string): boolean {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
