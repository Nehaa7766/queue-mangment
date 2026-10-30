import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { SignupWizard } from "@/components/onboarding/signup-wizard";
import { Skeleton } from "@/components/ui/skeleton";
import { getPlatformSettings } from "@/features/platform/settings-store";

export const metadata: Metadata = { title: "Set up your clinic · QueueCare" };

export default function SignupPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-[26px] font-bold">
          Set up your clinic
        </h1>
        <p className="text-sm text-muted-foreground">
          Three short steps. We review every new clinic before its queue goes
          live, usually within one working day.
        </p>
      </header>
      <Suspense fallback={<Skeleton className="h-96 rounded-card" />}>
        <SignupGate />
      </Suspense>
      <p className="text-sm text-muted-foreground">
        Already using QueueCare?{" "}
        <Link
          href="/login"
          className="font-medium text-brand underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

// Sign-ups can be switched off by a platform admin.
async function SignupGate() {
  await connection();
  const settings = await getPlatformSettings();
  if (!settings.signupsEnabled) {
    return (
      <section className="rounded-card border border-border bg-card p-6 shadow-card">
        <h2 className="font-display text-lg font-bold">Sign-ups are paused</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We aren&apos;t taking new clinics right now. Please get in touch and
          we&apos;ll set you up.
        </p>
      </section>
    );
  }
  return <SignupWizard />;
}
