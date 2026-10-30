import { z } from "zod";

// Opening hours in the exact shape Clinic.openingHours stores and
// isOpenNow (src/features/queue/clinic-time.ts) reads:
//   { "mon": [["09:00", "13:00"], ["17:00", "20:00"]] }
// A day without a key is closed; null (no hours set) means always open.
// Times are 24-hour "HH:MM" on the clinic's wall clock; a range runs from its
// opening minute up to, not including, its closing minute.
// Assumption: no overnight ranges; a day ends at 23:59.

export const WEEKDAYS = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export const MAX_RANGES_PER_DAY = 3;

export type TimeRange = [start: string, end: string];
export type OpeningHours = Partial<Record<Weekday, TimeRange[]>>;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const timeSchema = z.string().regex(TIME, "Use a 24-hour time like 09:00.");

const rangeSchema = z
  .tuple([timeSchema, timeSchema])
  .refine(([start, end]) => start < end, "Closing must be after opening.");

const dayRangesSchema = z
  .array(rangeSchema)
  .min(1)
  .max(MAX_RANGES_PER_DAY)
  .refine((ranges) => !hasOverlap(ranges), "Opening times overlap.");

export const openingHoursSchema = z
  .partialRecord(z.enum(WEEKDAYS), dayRangesSchema)
  .nullable();

function hasOverlap(ranges: readonly TimeRange[]): boolean {
  const sorted = [...ranges].sort((a, b) => a[0].localeCompare(b[0]));
  return sorted.some((range, i) => i > 0 && range[0] < sorted[i - 1][1]);
}

// ---- Editor model ----

export type DayForm = {
  open: boolean;
  ranges: { start: string; end: string }[];
};

export type HoursForm = {
  // Off means "always open": no hours are stored.
  enabled: boolean;
  days: Record<Weekday, DayForm>;
};

export type HoursFormErrors = Partial<Record<Weekday, string>>;

const DEFAULT_RANGE = { start: "09:00", end: "17:00" };

// Starting point when hours are first switched on: Monday to Saturday.
export function defaultDay(day: Weekday): DayForm {
  return { open: day !== "sun", ranges: [{ ...DEFAULT_RANGE }] };
}

// Reads whatever is stored, ignoring anything isOpenNow would ignore.
export function toHoursForm(stored: unknown): HoursForm {
  const enabled = stored !== null && typeof stored === "object";
  const record = enabled ? (stored as Record<string, unknown>) : {};
  const days = Object.fromEntries(
    WEEKDAYS.map((day) => {
      const value = record[day];
      const ranges = Array.isArray(value)
        ? value.flatMap((range) =>
            Array.isArray(range) &&
            typeof range[0] === "string" &&
            typeof range[1] === "string"
              ? [{ start: range[0], end: range[1] }]
              : [],
          )
        : [];
      const form: DayForm = enabled
        ? ranges.length > 0
          ? { open: true, ranges }
          : { open: false, ranges: [{ ...DEFAULT_RANGE }] }
        : defaultDay(day);
      return [day, form];
    }),
  ) as Record<Weekday, DayForm>;
  return { enabled, days };
}

// One message per day, or none when the form can be saved.
export function validateHoursForm(form: HoursForm): HoursFormErrors {
  if (!form.enabled) return {};
  const errors: HoursFormErrors = {};
  for (const day of WEEKDAYS) {
    const value = form.days[day];
    if (!value.open) continue;
    const result = dayRangesSchema.safeParse(
      value.ranges.map((range) => [range.start, range.end]),
    );
    if (!result.success) {
      errors[day] = result.error.issues[0]?.message ?? "Check these times.";
    }
  }
  return errors;
}

// The stored value, with each day's ranges in time order.
export function fromHoursForm(form: HoursForm): OpeningHours | null {
  if (!form.enabled) return null;
  const hours: OpeningHours = {};
  for (const day of WEEKDAYS) {
    const value = form.days[day];
    if (!value.open) continue;
    hours[day] = value.ranges
      .map((range): TimeRange => [range.start, range.end])
      .sort((a, b) => a[0].localeCompare(b[0]));
  }
  return hours;
}

// "09:00–13:00, 17:00–20:00" or "Closed", for read-only summaries.
export function describeDay(hours: OpeningHours | null, day: Weekday): string {
  if (hours === null) return "Open all day";
  const ranges = hours[day];
  if (!ranges || ranges.length === 0) return "Closed";
  return ranges.map(([start, end]) => `${start}–${end}`).join(", ");
}
