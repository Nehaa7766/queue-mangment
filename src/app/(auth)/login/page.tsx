import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in · QueueCare",
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Sign in"
      description="For clinic staff: reception, doctors and clinic admins."
    >
      <LoginForm />
    </AuthShell>
  );
}
