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
  // A count next to the label, e.g. unread chats; hidden at 0. `label` is
  // what screen readers hear for it, e.g. "3 unread".
  badge?: { count: number; label: string };
};

export type NavGroup = { label: string; items: NavItem[] };

// Puts live counts on the items with these hrefs.
export function withNavBadges(
  groups: NavGroup[],
  badges: Record<string, NavItem["badge"]>,
): NavGroup[] {
  return groups.map((group) => ({
    ...group,
    items: group.items.map((item) =>
      badges[item.href] ? { ...item, badge: badges[item.href] } : item,
    ),
  }));
}

export function badgeText(count: number): string {
  return count > 99 ? "99+" : String(count);
}

export function isActive(item: NavItem, pathname: string): boolean {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
