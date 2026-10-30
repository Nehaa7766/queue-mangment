"use client";

import { createContext, use, type ReactNode } from "react";
import type { StaffContext } from "@/lib/auth/staff-context";

const StaffContextValue = createContext<StaffContext | null>(null);

// Shares the signed-in staff member with client components in the shell.
export function StaffProvider({
  value,
  children,
}: {
  value: StaffContext;
  children: ReactNode;
}) {
  return <StaffContextValue value={value}>{children}</StaffContextValue>;
}

export function useStaff(): StaffContext {
  const value = use(StaffContextValue);
  if (!value) throw new Error("useStaff must be used inside the staff shell.");
  return value;
}
