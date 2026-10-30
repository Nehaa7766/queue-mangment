"use client";

import { CoffeeIcon, PlayIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { ApiError } from "@/components/queue/api-client";
import { Button, buttonVariants } from "@/components/ui/button";
import type { DoctorSelfView } from "@/features/doctor/contracts";
import { cn } from "@/lib/utils";
import { AvailabilityBadge } from "./availability-badge";
import { QUICK_BREAK_MINUTES, saveAvailability } from "./availability-client";
import { AVAILABILITY_DISPLAY } from "./availability-display";

// Dashboard card: current availability plus the one change a doctor makes
// most often — start a short break, or come back.
export function AvailabilityQuickToggle({
  doctor,
  onChange,
}: {
  doctor: DoctorSelfView;
  onChange: (doctor: DoctorSelfView) => void;
}) {
  const [saving, setSaving] = useState(false);
  const available = doctor.availability === "AVAILABLE";

  async function toggle() {
    setSaving(true);
    try {
      const updated = await saveAvailability(
        available
          ? {
              availability: "ON_BREAK",
              delayMinutes: QUICK_BREAK_MINUTES,
              note: doctor.note,
            }
          : { availability: "AVAILABLE", delayMinutes: 0, note: null },
      );
      onChange(updated);
      toast.success(
        updated.availability === "AVAILABLE"
          ? "Welcome back. You're shown as available."
          : `Break started. Patients see you'll be back in about ${QUICK_BREAK_MINUTES} min.`,
      );
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardCard
      title="Your availability"
      action={<AvailabilityBadge doctor={doctor} className="shrink-0" />}
      bodyClassName="flex flex-col gap-4"
    >
      <p className="text-sm text-muted-foreground">
        {AVAILABILITY_DISPLAY[doctor.availability].description}
      </p>
      {doctor.note && (
        <p className="rounded-btn bg-muted px-3 py-2 text-sm text-muted-foreground">
          Note for reception: “{doctor.note}”
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row xl:flex-col 2xl:flex-row">
        <Button
          variant={available ? "outline" : "default"}
          className="h-11 rounded-btn px-4 font-semibold"
          disabled={saving}
          onClick={() => void toggle()}
        >
          {available ? <CoffeeIcon /> : <PlayIcon />}
          {saving
            ? "Saving…"
            : available
              ? `Take a ${QUICK_BREAK_MINUTES}-min break`
              : "I'm available"}
        </Button>
        <Link
          href="/doctor/availability"
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "h-11 rounded-btn px-4",
          )}
        >
          More options
        </Link>
      </div>
    </DashboardCard>
  );
}
