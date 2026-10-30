import { Suspense, type ReactNode } from "react";
import {
  PlatformShell,
  PlatformShellFallback,
} from "@/components/platform/platform-shell";
import { requirePlatformPage } from "@/components/platform/platform-session";

// Super admins only. The session is read at request time, so the shell
// streams in behind a boundary; the fallback is the static shell.
export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PlatformShellFallback />}>
      <SignedInShell>{children}</SignedInShell>
    </Suspense>
  );
}

async function SignedInShell({ children }: { children: ReactNode }) {
  const user = await requirePlatformPage();
  return <PlatformShell user={user}>{children}</PlatformShell>;
}
