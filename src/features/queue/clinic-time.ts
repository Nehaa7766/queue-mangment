// Queue days are calendar dates in the clinic's timezone (docs/PLAN.md §8),
// stored in a Postgres DATE column.

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

// "YYYY-MM-DD" for the given moment in the clinic's timezone.
export function clinicToday(timezone: string, now: Date = new Date()): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

// Prisma maps DATE columns to a Date at UTC midnight.
export function toDbDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

export function fromDbDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Opening hours look like { "mon": [["09:00", "13:00"], ["17:00", "20:00"]] }.
// No hours configured means always open; a configured week without today's
// key means closed today.
export function isOpenNow(
  openingHours: unknown,
  timezone: string,
  now: Date = new Date(),
): boolean {
  if (openingHours === null || typeof openingHours !== "object") {
    return true;
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";

  const weekday = WEEKDAYS.find((day) =>
    part("weekday").toLowerCase().startsWith(day),
  );
  const time = `${part("hour")}:${part("minute")}`;
  const ranges = weekday
    ? (openingHours as Record<string, unknown>)[weekday]
    : undefined;
  if (!Array.isArray(ranges)) {
    return false;
  }
  return ranges.some(
    (range) =>
      Array.isArray(range) &&
      typeof range[0] === "string" &&
      typeof range[1] === "string" &&
      range[0] <= time &&
      time < range[1],
  );
}
