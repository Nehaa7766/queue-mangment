import { Cormorant_Garamond } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/layout/brand-mark";
import { cn } from "@/lib/utils";
import { TicketDate, TicketShift } from "./ticket-meta";

// Serif for the ticket and the heading. Loaded here so only the sign-in page
// downloads it, and applied with its own class rather than a global token.
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const SERIF = cormorant.className;

// Width of the ticket stub on desktop; the notches sit on its edge.
const STUB = "md:grid-cols-[minmax(0,370px)_minmax(0,1fr)]";

// Staff sign-in as an admission ticket: a mocha stub torn from a white form,
// over large faded token numbers.
export function LoginTicket({ children }: { children: ReactNode }) {
  return (
    <main
      className={cn(
        "relative flex min-h-svh flex-1 flex-col overflow-hidden bg-background px-4 py-6 md:px-10 md:py-8",
      )}
    >
      <BackgroundNumbers />

      <Link
        href="/"
        className="relative z-10 flex w-fit items-center gap-2.5 rounded-btn outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <BrandMark className="size-8" />
        <span className={cn(SERIF, "text-[22px] font-semibold tracking-tight")}>
          QueueCare
        </span>
      </Link>

      <div className="relative z-10 flex flex-1 items-center justify-center py-10">
        <section
          aria-labelledby="login-title"
          className={cn(
            "relative grid w-full max-w-[960px] rounded-[22px] shadow-[0_32px_80px_-28px_color-mix(in_oklab,var(--color-brand)_45%,transparent)]",
            STUB,
          )}
        >
          <Stub />

          <div className="rounded-b-[22px] bg-card px-6 py-9 sm:px-10 md:rounded-tr-[22px] md:rounded-bl-none md:px-14 md:py-14">
            <h1
              id="login-title"
              className={cn(
                SERIF,
                "text-[34px] leading-[1.05] font-medium md:text-[42px]",
              )}
            >
              Tear in to begin
              <br />
              your shift
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to open your counter.
            </p>
            <div className="mt-8">{children}</div>
          </div>

          {/* Punched notches where the stub tears off (desktop). */}
          <span
            aria-hidden
            className="absolute -top-3 left-[358px] hidden size-6 rounded-full bg-background md:block"
          />
          <span
            aria-hidden
            className="absolute -bottom-3 left-[358px] hidden size-6 rounded-full bg-background md:block"
          />
        </section>
      </div>
    </main>
  );
}

// The ticket's stub. Decoration: the token and counter are illustrative, so
// the whole stub is hidden from screen readers.
function Stub() {
  return (
    <div
      aria-hidden
      className="flex flex-col justify-between gap-8 rounded-t-[22px] border-b-2 border-dashed border-white/25 bg-brand px-8 py-8 text-white md:rounded-l-[22px] md:rounded-tr-none md:border-r-2 md:border-b-0 md:px-10 md:py-10"
    >
      <div>
        <p className="text-[11px] font-semibold tracking-[0.22em] text-brand-muted uppercase">
          Admit one · Staff
        </p>
        <TicketDate className="mt-1 text-xs text-brand-muted" />
      </div>

      <div>
        <p className={cn(SERIF, "text-[28px] text-blush italic")}>your token</p>
        <p
          className={cn(
            SERIF,
            "text-[76px] leading-none font-medium tabular-nums md:text-[96px]",
          )}
        >
          A-042
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-white/20 pt-4">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] text-brand-muted uppercase">
            Counter
          </p>
          <p className="mt-1 font-semibold">03</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] text-brand-muted uppercase">
            Shift
          </p>
          <TicketShift className="mt-1 font-semibold" />
        </div>
      </div>
    </div>
  );
}

// Huge faded token numbers behind the ticket, top and bottom.
function BackgroundNumbers() {
  const row =
    "absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[clamp(110px,15vw,230px)] leading-none tracking-wide";
  return (
    <div
      aria-hidden
      className={cn(
        SERIF,
        "pointer-events-none absolute inset-0 overflow-hidden text-blush/70 select-none",
      )}
    >
      <p className={cn(row, "top-[2%]")}>039&ensp;040&ensp;041</p>
      <p className={cn(row, "-bottom-[0.42em] opacity-60")}>
        042&ensp;043&ensp;044
      </p>
    </div>
  );
}
