import type { ReactNode } from "react";
import { messages } from "./messages";

// The patient's token as a printed slip: slate stub on top, a perforation
// with two notches, then the white body (docs/GUI_RULES.md §5, phone layout).
export function TicketHero({
  tokenLabel,
  serviceName,
  clinicName,
  children,
}: {
  tokenLabel: string;
  serviceName: string;
  clinicName: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={messages.token.yourToken}
      className="relative overflow-hidden rounded-card border border-border bg-card"
    >
      <div className="flex flex-col items-center gap-1 bg-slate px-6 pt-5 pb-6 text-center text-white">
        <span className="text-[11px] font-semibold tracking-[0.08em] text-slate-muted uppercase">
          {messages.token.yourToken}
        </span>
        <span
          data-testid="token-label"
          className="font-display text-[56px] leading-none font-extrabold tabular-nums sm:text-[64px]"
        >
          {tokenLabel}
        </span>
        <span className="mt-1 text-base text-sand">{serviceName}</span>
        <span className="text-sm text-slate-muted">{clinicName}</span>
      </div>

      <div
        aria-hidden="true"
        className="relative border-t-2 border-dashed border-background"
      >
        <span className="absolute -top-2.5 -left-[9px] size-[18px] rounded-full bg-background" />
        <span className="absolute -top-2.5 -right-[9px] size-[18px] rounded-full bg-background" />
      </div>

      <div className="flex flex-col gap-4 p-5">{children}</div>
    </section>
  );
}
