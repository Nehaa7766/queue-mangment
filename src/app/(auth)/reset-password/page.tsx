import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Choose a new password · QueueCare",
};

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Choose a new password">
      {/* The token comes from the URL, which is only known at request time. */}
      <Suspense fallback={<Skeleton className="h-52 w-full rounded-card" />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
