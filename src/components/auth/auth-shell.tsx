import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark, BrandName } from "@/components/layout/brand-mark";

const POINTS = [
  "Patients join from their phone by scanning a QR code",
  "Reception and doctors run the queue from one screen",
  "No patient app, account or phone number needed",
];

// Sign-in and the standalone status pages (unauthorized, not found, error).
// Desktop: mocha brand panel on the left, white form card on the right.
// Phone: one column with the logo on top.
export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <main className="grid min-h-svh flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand px-10 py-10 text-white lg:flex xl:px-14">
        {/* Soft circles for depth; decoration only. */}
        <span
          aria-hidden="true"
          className="absolute -top-24 -right-24 size-72 rounded-full bg-white/5"
        />
        <span
          aria-hidden="true"
          className="absolute -bottom-32 -left-20 size-96 rounded-full bg-white/5"
        />

        <Link
          href="/"
          className="relative flex w-fit items-center gap-2.5 rounded-btn outline-none focus-visible:ring-3 focus-visible:ring-white/60"
        >
          <BrandMark className="bg-white text-brand" />
          <span className="font-display text-xl font-extrabold tracking-tight">
            QueueCare
          </span>
        </Link>

        <div className="relative flex max-w-md flex-col gap-6">
          <p className="font-display text-[32px] leading-tight font-bold">
            Shorter waits. Calmer clinics.
          </p>
          <ul className="flex flex-col gap-3">
            {POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3 text-base">
                <CheckCircle2
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 text-brand-muted"
                />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-brand-muted">
          QueueCare · Clinic queue management
        </p>
      </aside>

      <div className="flex flex-col items-center justify-center bg-background px-4 py-10 sm:px-6">
        <div className="flex w-full max-w-md flex-col gap-6">
          <Link
            href="/"
            className="flex w-fit items-center gap-2.5 rounded-btn outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden"
          >
            <BrandMark />
            <BrandName className="text-lg" />
          </Link>
          <section className="flex flex-col gap-5 rounded-card border border-border bg-card p-6 shadow-card sm:p-8">
            <header className="flex flex-col gap-1">
              <h1 className="font-display text-2xl font-bold">{title}</h1>
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </header>
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}
