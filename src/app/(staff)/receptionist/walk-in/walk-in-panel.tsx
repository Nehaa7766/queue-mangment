"use client";

import Link from "next/link";
import { useState } from "react";
import { WalkInForm } from "@/components/queue/walk-in-form";
import { buttonVariants } from "@/components/ui/button";
import type {
  StaffQueueSummary,
  StaffTokenView,
} from "@/features/queue/contracts";
import { cn } from "@/lib/utils";

// Walk-in form plus a confirmation of the last token created, so reception
// can read the token number out to the patient.
export function WalkInPanel({ queues }: { queues: StaffQueueSummary[] }) {
  const [created, setCreated] = useState<StaffTokenView | null>(null);
  return (
    <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-card border border-border bg-card p-5">
        <WalkInForm queues={queues} onCreated={setCreated} />
      </section>
      <aside
        aria-live="polite"
        className="rounded-card border border-border bg-card p-5"
      >
        {created ? (
          <div className="flex flex-col gap-3">
            <p className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
              Last token created
            </p>
            <p className="font-display text-5xl font-extrabold tabular-nums">
              {created.tokenLabel}
            </p>
            <p className="text-sm">
              {created.patientName} · {created.serviceName}
            </p>
            <Link
              href="/receptionist/queue"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-10 rounded-btn",
              )}
            >
              Open live queue
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            The new token number appears here so you can tell the patient.
          </p>
        )}
      </aside>
    </div>
  );
}
