import {
  ArrowRight,
  QrCode,
  Smartphone,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { BrandMark, BrandName } from "@/components/layout/brand-mark";
import { ScanQrButton } from "@/components/patient/qr-scanner";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: QrCode,
    title: "Join by QR code",
    body: "Patients scan the code at the clinic and join from their own phone.",
  },
  {
    icon: Smartphone,
    title: "Live token status",
    body: "People ahead and a wait range on the patient's phone, updated by itself.",
  },
  {
    icon: Stethoscope,
    title: "One screen for staff",
    body: "Reception calls the next patient; doctors start and finish consultations.",
  },
];

// Public landing page: what QueueCare is, the way in for staff, and a note
// for patients who end up here instead of their clinic's page.
export default function Home() {
  return (
    <div className="flex min-h-svh flex-1 flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 md:px-6">
          <span className="flex items-center gap-2.5">
            <BrandMark />
            <BrandName />
          </span>
          <Link
            href="/login"
            className={cn(buttonVariants(), "h-10 rounded-btn px-4")}
          >
            Staff sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-4 py-12 md:px-6 lg:grid-cols-2 lg:py-20">
        <div className="flex flex-col gap-6">
          <p className="w-fit rounded-full bg-brand-tint px-3 py-1 text-xs font-semibold tracking-wide text-brand uppercase">
            QueueCare
          </p>
          <h1 className="font-display text-4xl leading-tight font-bold md:text-5xl">
            Clinic queue management
          </h1>
          <p className="max-w-lg text-lg text-muted-foreground">
            Patients join from their phone and see when it&apos;s their turn.
            Reception, doctors and clinic admins run the queue from one screen.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className={cn(
                buttonVariants(),
                "h-12 rounded-btn px-6 text-base font-semibold",
              )}
            >
              Staff sign in
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <ScanQrButton />
          </div>
          <p className="flex max-w-lg items-start gap-3 rounded-card border border-border bg-card p-4 text-sm shadow-card">
            <QrCode
              className="mt-0.5 size-5 shrink-0 text-brand"
              aria-hidden="true"
            />
            <span>
              <strong className="font-semibold">Patients:</strong> tap{" "}
              <strong className="font-semibold">Scan QR code</strong> (or use
              your phone&apos;s camera) on the code at your clinic to join the
              queue. No app or account needed.
            </span>
          </p>
        </div>

        <TicketPreview />
      </main>

      <section
        aria-labelledby="features-heading"
        className="border-t border-border bg-card"
      >
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 md:grid-cols-3 md:px-6">
          <h2 id="features-heading" className="sr-only">
            What QueueCare does
          </h2>
          {FEATURES.map((feature) => (
            <div key={feature.title} className="flex flex-col gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-brand-tint text-brand">
                <feature.icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="text-base font-semibold">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <p className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-muted-foreground md:px-6">
          QueueCare · Shorter waits, calmer clinics.
        </p>
      </footer>
    </div>
  );
}

// What reception sees, with sample data. The buttons are part of the
// picture, so they're disabled but drawn at full strength.
function TicketPreview() {
  return (
    <figure className="flex flex-col gap-3">
      <section
        aria-label="Now serving"
        className="flex flex-col overflow-hidden rounded-card border border-border bg-card shadow-card sm:flex-row"
      >
        <div className="flex flex-col gap-1 border-b-2 border-dashed border-background bg-brand px-6 py-6 text-white sm:w-48 sm:border-r-2 sm:border-b-0">
          <span className="text-[11px] font-semibold tracking-[0.1em] text-brand-muted uppercase">
            Now serving
          </span>
          <span className="font-display text-5xl font-extrabold tabular-nums">
            A-17
          </span>
          <span className="text-sm text-brand-muted">Room 2</span>
        </div>

        <div className="flex flex-1 flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">Priya R.</p>
              <p className="text-sm text-muted-foreground">
                General · Dr. Anjali Shah
              </p>
            </div>
            <span className="rounded-full bg-status-wait px-3 py-1 text-xs font-semibold text-status-wait-foreground tabular-nums">
              Called 1:42
            </span>
          </div>
          <div aria-hidden="true" className="h-1.5 rounded-full bg-muted">
            <div className="h-1.5 w-2/3 rounded-full bg-brand" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled
              className="h-11 rounded-btn px-5 font-semibold disabled:opacity-100"
            >
              Call next
            </Button>
            <Button
              disabled
              variant="outline"
              className="h-11 rounded-btn px-5 disabled:opacity-100"
            >
              Recall
            </Button>
            <Button
              disabled
              variant="outline"
              className="h-11 rounded-btn px-5 disabled:opacity-100"
            >
              Skip
            </Button>
          </div>
        </div>
      </section>

      <dl className="grid grid-cols-3 gap-3">
        {[
          { label: "Waiting", value: "18" },
          { label: "Served today", value: "52" },
          { label: "Average wait", value: "18 min" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col gap-1 rounded-card border border-border bg-card p-4 shadow-card"
          >
            <dt className="text-xs text-muted-foreground">{stat.label}</dt>
            <dd className="font-display text-xl font-bold tabular-nums">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
      <figcaption className="text-xs text-muted-foreground">
        Preview with sample data.
      </figcaption>
    </figure>
  );
}
