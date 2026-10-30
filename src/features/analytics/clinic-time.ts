// Calendar maths in the clinic's timezone. Queue days and dashboard hours
// follow the clinic's wall clock, not the server's.

function parts(date: Date, timeZone: string) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return values as Record<"year" | "month" | "day" | "hour" | "minute", string>;
}

// YYYY-MM-DD in the clinic's timezone.
export function clinicDate(date: Date, timeZone: string): string {
  const { year, month, day } = parts(date, timeZone);
  return `${year}-${month}-${day}`;
}

// 0–23 in the clinic's timezone.
export function clinicHour(date: Date, timeZone: string): number {
  return Number(parts(date, timeZone).hour);
}

// "09:05" in the clinic's timezone.
export function clinicTime(date: Date, timeZone: string): string {
  const { hour, minute } = parts(date, timeZone);
  return `${hour}:${minute}`;
}

// Prisma maps a @db.Date column to a Date at UTC midnight.
export function toDbDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function minutesBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60_000));
}
