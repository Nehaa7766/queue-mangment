import type { DoctorSelfView } from "@/features/doctor/contracts";
import { cn } from "@/lib/utils";
import { AVAILABILITY_DISPLAY } from "./availability-display";

// The doctor's own status pill, with the announced delay when there is one.
export function AvailabilityBadge({
  doctor,
  className,
}: {
  doctor: Pick<DoctorSelfView, "availability" | "delayMinutes">;
  className?: string;
}) {
  const display = AVAILABILITY_DISPLAY[doctor.availability];
  const delay =
    doctor.availability !== "OFF_DUTY" && doctor.delayMinutes > 0
      ? doctor.availability === "ON_BREAK"
        ? ` · ${doctor.delayMinutes} min`
        : ` · ${doctor.delayMinutes} min late`
      : "";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        display.className,
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {display.label}
      {delay}
    </span>
  );
}
