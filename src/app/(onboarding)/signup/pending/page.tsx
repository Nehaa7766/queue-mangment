import { HourglassIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { clinicSlugSchema } from "@/features/onboarding/slug";

export const metadata: Metadata = { title: "Clinic created · QueueCare" };

export default function SignupPendingPage({
  searchParams,
}: PageProps<"/signup/pending">) {
  return (
    <section
      aria-live="polite"
      className="flex flex-col gap-4 rounded-card border border-border bg-card p-6 shadow-card sm:p-8"
    >
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-full bg-brand-tint text-brand"
      >
        <HourglassIcon className="size-5" />
      </span>
      <h1 className="font-display text-[26px] font-bold">
        Your clinic is waiting for approval
      </h1>
      <Suspense fallback={null}>
        <Address searchParams={searchParams} />
      </Suspense>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
        <li>We review new clinics, usually within one working day.</li>
        <li>
          Until then you can sign in, but the clinic screens and the patient
          page stay off.
        </li>
      </ul>
      <div>
        <Link
          href="/login"
          className="inline-flex h-11 items-center rounded-btn bg-primary px-5 text-sm font-semibold text-primary-foreground outline-none hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Go to sign in
        </Link>
      </div>
    </section>
  );
}

async function Address({
  searchParams,
}: {
  searchParams: PageProps<"/signup/pending">["searchParams"];
}) {
  const raw = (await searchParams).clinic;
  const slug = clinicSlugSchema.safeParse(Array.isArray(raw) ? raw[0] : raw);
  if (!slug.success) return null;
  return (
    <p className="text-sm text-muted-foreground">
      Once approved, patients join your queue at{" "}
      <span className="font-semibold text-foreground">/q/{slug.data}</span>.
    </p>
  );
}
