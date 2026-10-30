import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import {
  StaffShell,
  StaffShellFallback,
} from "@/components/layout/staff-shell";
import { loadStaffContext } from "@/components/layout/staff-session";

// Every staff panel shares this shell. The session is read at request time,
// so the shell streams in behind a boundary; the fallback is the static shell.
export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<StaffShellFallback />}>
      <SignedInShell>{children}</SignedInShell>
    </Suspense>
  );
}

async function SignedInShell({ children }: { children: ReactNode }) {
  const context = await loadStaffContext();
  if (!context) redirect("/login");
  return <StaffShell context={context}>{children}</StaffShell>;
}
