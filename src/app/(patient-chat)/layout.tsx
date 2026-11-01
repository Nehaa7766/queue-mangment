import type { ReactNode } from "react";

// The patient's chat screen fills the phone like a messaging app, with its
// own header (back to the token, who they're talking to), so it skips the
// patient top bar of the (public) layout.
export default function PatientChatLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main className="flex h-dvh flex-col bg-background text-base">
      {children}
    </main>
  );
}
