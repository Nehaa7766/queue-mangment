import type { TokenStatus } from "@/features/queue/token-status";
import { minutesBetween } from "./clinic-time";
import { daysEndingOn, formatDayLabel } from "./range-time";

// Clinic admin analytics (docs/PLAN.md §2 pilot metrics) over today, the
// last 7 days or the last 30 days. Built in memory: a month of a pilot
// clinic is a few thousand tokens.

export const ANALYTICS_RANGES = ["today", "7d", "30d"] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export const RANGE_DAYS: Record<AnalyticsRange, number> = {
  today: 1,
  "7d": 7,
  "30d": 30,
};

export const RANGE_LABELS: Record<AnalyticsRange, string> = {
  today: "Today",
  "7d": "7 days",
  "30d": "30 days",
};

export type AnalyticsToken = {
  // Queue day, YYYY-MM-DD in the clinic's timezone.
  queueDate: string;
  serviceId: string;
  serviceName: string;
  status: TokenStatus;
  // Registered by staff rather than joined by QR code.
  walkIn: boolean;
  joinedAt: Date;
  calledAt: Date | null;
  serviceStartedAt: Date | null;
  completedAt: Date | null;
};

export type WaitStats = {
  // Null when nobody in the group has been called.
  averageWaitMinutes: number | null;
  medianWaitMinutes: number | null;
};

export type AnalyticsCounts = {
  joined: number;
  completed: number;
  noShows: number;
  cancelled: number;
} & WaitStats;

export type AdminAnalyticsView = {
  range: AnalyticsRange;
  days: string[];
  totals: AnalyticsCounts & {
    qrJoins: number;
    walkIns: number;
    // Share of finished tokens that were no-shows, 0–100.
    noShowRate: number | null;
    averageConsultationMinutes: number | null;
  };
  daily: (AnalyticsCounts & { date: string; label: string })[];
  byService: (AnalyticsCounts & { serviceId: string; serviceName: string })[];
};

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function counts(tokens: readonly AnalyticsToken[]): AnalyticsCounts {
  // Wait = joining until first called. Recalls reset calledAt, so a recalled
  // token's wait runs to its latest call.
  const waits = tokens.flatMap((token) =>
    token.calledAt ? [minutesBetween(token.joinedAt, token.calledAt)] : [],
  );
  return {
    joined: tokens.length,
    completed: tokens.filter((token) => token.status === "COMPLETED").length,
    noShows: tokens.filter((token) => token.status === "SKIPPED").length,
    cancelled: tokens.filter((token) => token.status === "CANCELLED").length,
    averageWaitMinutes: average(waits),
    medianWaitMinutes: median(waits),
  };
}

export function buildAdminAnalytics(input: {
  range: AnalyticsRange;
  today: string;
  tokens: readonly AnalyticsToken[];
}): AdminAnalyticsView {
  const days = daysEndingOn(input.today, RANGE_DAYS[input.range]);
  const inRange = input.tokens.filter((token) =>
    days.includes(token.queueDate),
  );
  const totals = counts(inRange);
  const finished = totals.completed + totals.noShows;
  const consultations = inRange.flatMap((token) =>
    token.serviceStartedAt && token.completedAt
      ? [minutesBetween(token.serviceStartedAt, token.completedAt)]
      : [],
  );

  const services = new Map<string, string>();
  for (const token of inRange) services.set(token.serviceId, token.serviceName);

  return {
    range: input.range,
    days,
    totals: {
      ...totals,
      qrJoins: inRange.filter((token) => !token.walkIn).length,
      walkIns: inRange.filter((token) => token.walkIn).length,
      noShowRate:
        finished === 0 ? null : Math.round((totals.noShows / finished) * 100),
      averageConsultationMinutes: average(consultations),
    },
    daily: days.map((date) => ({
      date,
      label: formatDayLabel(date),
      ...counts(inRange.filter((token) => token.queueDate === date)),
    })),
    byService: [...services]
      .map(([serviceId, serviceName]) => ({
        serviceId,
        serviceName,
        ...counts(inRange.filter((token) => token.serviceId === serviceId)),
      }))
      .sort((a, b) => b.joined - a.joined),
  };
}
