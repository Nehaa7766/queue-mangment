// Calendar ranges in the clinic's timezone, for reports that span days.

const DAY_MS = 24 * 60 * 60 * 1000;

// "YYYY-MM-DD" plus or minus whole days.
export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

// Every day from `count - 1` days before `lastDay` up to `lastDay`.
export function daysEndingOn(lastDay: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    addDays(lastDay, i - count + 1),
  );
}

// How far the clinic's wall clock is ahead of UTC at `instant`, in ms.
function utcOffset(instant: Date, timeZone: string): number {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(instant)
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<"year" | "month" | "day" | "hour" | "minute" | "second", number>;
  const wallClock = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second,
  );
  return wallClock - Math.floor(instant.getTime() / 1000) * 1000;
}

// The instant the clinic's day starts. Assumes no DST change at midnight,
// which holds for India and most clinic timezones.
export function clinicDayStart(day: string, timeZone: string): Date {
  const midnightUtc = Date.parse(`${day}T00:00:00.000Z`);
  return new Date(midnightUtc - utcOffset(new Date(midnightUtc), timeZone));
}

// [start, end) of a clinic day, for filtering timestamps.
export function clinicDayBounds(
  day: string,
  timeZone: string,
): { start: Date; end: Date } {
  return {
    start: clinicDayStart(day, timeZone),
    end: clinicDayStart(addDays(day, 1), timeZone),
  };
}

// "Mon 27 Oct" for a YYYY-MM-DD date.
export function formatDayLabel(day: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${day}T00:00:00.000Z`));
}
