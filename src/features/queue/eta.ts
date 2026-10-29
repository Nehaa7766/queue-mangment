// Below this many recent consultations, fall back to the service's estimate.
const MIN_SAMPLES = 5;
// How far either side of the expected wait the range reaches.
const SPREAD = 0.25;
const ROUND_TO_MINUTES = 5;

export type WaitEstimate = {
  minMinutes: number;
  maxMinutes: number;
  // True when based on the service's estimate rather than real recent data.
  isRough: boolean;
};

/*
 * How the estimate works:
 *   perPatient = median of recent consultation durations (if at least 5),
 *                otherwise the service's estimated duration (rough)
 *   expected   = peopleAhead × perPatient ÷ max(1, activeDoctors)
 *   min        = expected × 0.75, rounded down to 5 minutes (never below 0)
 *   max        = expected × 1.25, rounded up to 5 minutes, and at least min + 5
 *
 * Always a range, never one exact number (docs/PLAN.md §9, rule 13).
 */
export function estimateWait(input: {
  peopleAhead: number;
  serviceMinutes: number;
  recentDurationsMinutes: readonly number[];
  activeDoctors: number;
}): WaitEstimate {
  const samples = input.recentDurationsMinutes.filter(
    (minutes) => Number.isFinite(minutes) && minutes > 0,
  );
  const isRough = samples.length < MIN_SAMPLES;
  const perPatient = isRough ? input.serviceMinutes : median(samples);

  const peopleAhead = Math.max(0, input.peopleAhead);
  const doctors = Math.max(1, input.activeDoctors);
  const expected = (peopleAhead * Math.max(0, perPatient)) / doctors;

  const minMinutes = Math.max(0, roundDown(expected * (1 - SPREAD)));
  const maxMinutes = Math.max(
    roundUp(expected * (1 + SPREAD)),
    minMinutes + ROUND_TO_MINUTES,
  );

  return { minMinutes, maxMinutes, isRough };
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function roundDown(minutes: number): number {
  return Math.floor(minutes / ROUND_TO_MINUTES) * ROUND_TO_MINUTES;
}

function roundUp(minutes: number): number {
  return Math.ceil(minutes / ROUND_TO_MINUTES) * ROUND_TO_MINUTES;
}
