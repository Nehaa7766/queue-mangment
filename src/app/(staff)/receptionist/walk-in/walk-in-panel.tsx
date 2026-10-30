"use client";

import Link from "next/link";
import { useState } from "react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
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
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <DashboardCard
        title="Patient details"
        description="Choose the service, then add the patient's name."
      >
        <WalkInForm queues={queues} onCreated={setCreated} />
      </DashboardCard>
      <DashboardCard title="Last token created">
        <div aria-live="polite">
          {created ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <span className="flex h-16 min-w-20 items-center justify-center rounded-btn bg-brand px-3 font-display text-3xl font-extrabold text-white tabular-nums">
                  {created.tokenLabel}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {created.patientName}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {created.serviceName}
                  </p>
                </div>
              </div>
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
        </div>
      </DashboardCard>
    </div>
  );
}
