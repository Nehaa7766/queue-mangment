import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignOutButton } from "@/components/auth/sign-out-button";

export const metadata: Metadata = {
  title: "No access · QueueCare",
};

export default function UnauthorizedPage() {
  return (
    <AuthShell
      title="You don't have access"
      description="Your account isn't linked to a clinic role that can open this page. Ask your clinic admin to check your access."
    >
      <SignOutButton className="h-11 w-full rounded-btn" />
    </AuthShell>
  );
}
