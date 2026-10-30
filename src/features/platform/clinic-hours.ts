import {
  WEEKDAYS,
  WEEKDAY_LABELS,
  type Weekday,
} from "@/features/clinics/opening-hours";
import type { SimpleHours } from "@/features/clinics/profile-fields";

// Short text for a clinic's hours on the super-admin pages. Client-safe.

export type ClinicHours =
  | { kind: "simple"; hours: SimpleHours }
  // Split or per-day hours, set in the clinic's own settings.
  | { kind: "custom" }
  | { kind: "none" };

const short = (day: Weekday) => WEEKDAY_LABELS[day].slice(0, 3);

// ["mon", …, "sat"] → "Mon–Sat"; ["mon", "wed", "thu"] → "Mon, Wed–Thu".
export function formatWorkingDays(days: readonly Weekday[]): string {
  const chosen = WEEKDAYS.filter((day) => days.includes(day));
  if (chosen.length === 7) return "Every day";
  const runs: Weekday[][] = [];
  for (const day of chosen) {
    const run = runs.at(-1);
    const previous = run?.at(-1);
    if (
      run &&
      previous &&
      WEEKDAYS.indexOf(previous) + 1 === WEEKDAYS.indexOf(day)
    ) {
      run.push(day);
    } else {
      runs.push([day]);
    }
  }
  return runs
    .map((run) =>
      run.length === 1
        ? short(run[0])
        : `${short(run[0])}–${short(run[run.length - 1])}`,
    )
    .join(", ");
}

export function hoursSummary(hours: ClinicHours): string {
  if (hours.kind === "none") return "Not set";
  if (hours.kind === "custom") return "Custom hours";
  const { workingDays, openingTime, closingTime } = hours.hours;
  return `${formatWorkingDays(workingDays)} · ${openingTime}–${closingTime}`;
}
