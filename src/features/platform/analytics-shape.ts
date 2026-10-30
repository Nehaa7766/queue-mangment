// Pure shaping for the super-admin dashboard charts. The queries in
// analytics.ts return raw counts; these turn them into chart series and the
// totals shown as text beside each chart.

// Platform-wide days are counted in Indian time, where every clinic is today.
export const PLATFORM_TIMEZONE = "Asia/Kolkata";

export const ANALYTICS_RANGES = [7, 30, 90] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];
export const DEFAULT_RANGE: AnalyticsRange = 30;

export function parseRange(value: string | undefined): AnalyticsRange {
  const days = Number(value);
  return (ANALYTICS_RANGES as readonly number[]).includes(days)
    ? (days as AnalyticsRange)
    : DEFAULT_RANGE;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// "2026-10-30" for an instant, in the given timezone.
export function dayKey(date: Date, timezone = PLATFORM_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// The last `range` days, oldest first, ending today.
export function rangeDays(
  range: AnalyticsRange,
  now: Date,
  timezone = PLATFORM_TIMEZONE,
): string[] {
  const today = dayKey(now, timezone);
  // Step back from noon UTC of today's date, so no timezone or leap second
  // can skip or repeat a day.
  const anchor = Date.parse(`${today}T12:00:00.000Z`);
  return Array.from({ length: range }, (_, index) =>
    new Date(anchor - (range - 1 - index) * DAY_MS).toISOString().slice(0, 10),
  );
}

// Earliest instant a query needs: a day before the first range day, so the
// exact local-day filter in SQL can do the rest.
export function querySince(range: AnalyticsRange, now: Date): Date {
  return new Date(now.getTime() - (range + 1) * DAY_MS);
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// "2026-10-14" → "14 Oct".
export function dayLabel(day: string): string {
  const [, month, date] = day.split("-");
  return `${Number(date)} ${MONTHS[Number(month) - 1]}`;
}

export type Bucket = { label: string; days: string[] };

// Daily for a week; weekly otherwise, counted back from today so the latest
// bucket is a whole week and only the oldest may be short.
export function growthBuckets(days: readonly string[]): Bucket[] {
  if (days.length <= 7) {
    return days.map((day) => ({ label: dayLabel(day), days: [day] }));
  }
  const buckets: Bucket[] = [];
  for (let end = days.length; end > 0; end -= 7) {
    const chunk = days.slice(Math.max(0, end - 7), end);
    buckets.unshift({ label: dayLabel(chunk[0]), days: chunk });
  }
  return buckets;
}

function countByDay(dayKeys: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const day of dayKeys) counts.set(day, (counts.get(day) ?? 0) + 1);
  return counts;
}

export type GrowthPoint = {
  label: string;
  signups: number;
  approved: number;
  // Active clinics at the end of the bucket.
  active: number;
};

export type ClinicGrowth = {
  points: GrowthPoint[];
  totals: {
    signups: number;
    approved: number;
    suspended: number;
    activeNow: number;
  };
};

// Sign-ups and approvals per bucket, plus active clinics over time. The
// active line is rebuilt backwards from today's count by undoing the
// approvals and suspensions that happened later; clinics created already
// active (e.g. by hand) count from the start, so it is an estimate.
export function shapeClinicGrowth(input: {
  days: readonly string[];
  signupDays: readonly string[];
  approvalDays: readonly string[];
  suspensionDays: readonly string[];
  activeNow: number;
}): ClinicGrowth {
  const inRange = new Set(input.days);
  const signups = countByDay(input.signupDays.filter((d) => inRange.has(d)));
  const approvals = countByDay(
    input.approvalDays.filter((d) => inRange.has(d)),
  );
  const suspensions = countByDay(
    input.suspensionDays.filter((d) => inRange.has(d)),
  );
  const sum = (counts: Map<string, number>, days: readonly string[]) =>
    days.reduce((total, day) => total + (counts.get(day) ?? 0), 0);

  const buckets = growthBuckets(input.days);
  let active = input.activeNow;
  const points: GrowthPoint[] = [];
  // Walk newest to oldest: a bucket ends where the next one begins.
  for (let index = buckets.length - 1; index >= 0; index -= 1) {
    const bucket = buckets[index];
    points.unshift({
      label: bucket.label,
      signups: sum(signups, bucket.days),
      approved: sum(approvals, bucket.days),
      active: Math.max(0, active),
    });
    active =
      active - sum(approvals, bucket.days) + sum(suspensions, bucket.days);
  }

  return {
    points,
    totals: {
      signups: sum(signups, input.days),
      approved: sum(approvals, input.days),
      suspended: sum(suspensions, input.days),
      activeNow: input.activeNow,
    },
  };
}
