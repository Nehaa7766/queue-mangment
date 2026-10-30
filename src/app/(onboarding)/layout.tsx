import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark, BrandName } from "@/components/layout/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Plain public frame for sign-up and support: white top bar with the brand on
// the left and sign-in on the right, content centred on the grey page. No
// staff navigation.
export default function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4 md:px-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-btn outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <BrandMark />
            <BrandName />
          </Link>
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-10 rounded-btn px-4",
            )}
          >
            Sign in
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8 md:py-12">
        {children}
      </main>
    </div>
  );
}
