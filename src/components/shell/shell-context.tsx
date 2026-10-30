"use client";

import {
  createContext,
  use,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type ShellInfo = {
  // First breadcrumb, e.g. "/receptionist".
  homeHref: string;
  // Request time and the clinic's timezone, for the date in the page header.
  now: number;
  timezone: string;
};

type ShellUi = {
  // Desktop sidebar shrunk to icons.
  collapsed: boolean;
  toggleCollapsed: () => void;
  // Menu drawer below lg.
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
};

const ShellInfoContext = createContext<ShellInfo | null>(null);
const ShellUiContext = createContext<ShellUi | null>(null);

// The collapsed sidebar is remembered per browser. The server always renders
// it open; useSyncExternalStore switches to the stored value after hydration.
const COLLAPSED_KEY = "queuecare.sidebar-collapsed";
const collapsedListeners = new Set<() => void>();
// Used when storage is blocked, so the toggle still works this visit.
let collapsedInMemory = false;

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return collapsedInMemory;
  }
}

function subscribeCollapsed(onChange: () => void): () => void {
  collapsedListeners.add(onChange);
  return () => collapsedListeners.delete(onChange);
}

function toggleCollapsed(): void {
  collapsedInMemory = !readCollapsed();
  try {
    localStorage.setItem(COLLAPSED_KEY, collapsedInMemory ? "1" : "0");
  } catch {
    // Not remembered for next time; still toggles now.
  }
  collapsedListeners.forEach((listener) => listener());
}

export function ShellProvider({
  info,
  children,
}: {
  info: ShellInfo;
  children: ReactNode;
}) {
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    readCollapsed,
    () => false,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  const ui = useMemo(
    () => ({ collapsed, toggleCollapsed, drawerOpen, setDrawerOpen }),
    [collapsed, drawerOpen],
  );

  return (
    <ShellInfoContext value={info}>
      <ShellUiContext value={ui}>{children}</ShellUiContext>
    </ShellInfoContext>
  );
}

export function useShellInfo(): ShellInfo {
  const value = use(ShellInfoContext);
  if (!value) throw new Error("useShellInfo must be used inside AppShell.");
  return value;
}

export function useShellUi(): ShellUi {
  const value = use(ShellUiContext);
  if (!value) throw new Error("useShellUi must be used inside AppShell.");
  return value;
}
