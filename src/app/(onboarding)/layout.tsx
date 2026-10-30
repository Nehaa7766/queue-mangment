import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/layout/brand-mark";

// Plain public frame for sign-up and support: brand on the left, sign-in on
// the right, content centered. No staff navigation.
export default function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 items-center justify-between gap-3 border-b border-border bg-card px-4 md:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-btn outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <BrandMark className="size-8" />
          <span className="font-display font-bold">QueueCare</span>
        </Link>
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center rounded-btn px-3 text-sm font-medium text-slate outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Sign in
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8 md:py-12">
        {children}
      </main>
    </div>
  );
}
