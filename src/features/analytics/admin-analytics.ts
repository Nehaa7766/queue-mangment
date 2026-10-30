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

// ---- Admin dashboard ----

export type DashboardService = {
  serviceId: string;
  serviceName: string;
  tokenPrefix: string;
};

export type AdminDashboardServiceView = DashboardService & {
  joinedToday: number;
  completedToday: number;
  // Patients joined per day over the last 7 days, oldest first.
  joinedByDay: number[];
  // Joined today minus joined yesterday.
  changeVsYesterday: number;
};

export type AdminDashboardView = {
  today: AdminAnalyticsView;
  week: AdminAnalyticsView;
  month: AdminAnalyticsView;
  services: AdminDashboardServiceView[];
};

// Everything the admin dashboard shows, from one month of tokens: today's
// numbers, the last 7 and 30 days, and a small trend per active service.
export function buildAdminDashboard(input: {
  today: string;
  tokens: readonly AnalyticsToken[];
  // Active services in display order, including ones with no tokens yet.
  services: readonly DashboardService[];
}): AdminDashboardView {
  const today = buildAdminAnalytics({ ...input, range: "today" });
  const week = buildAdminAnalytics({ ...input, range: "7d" });
  const month = buildAdminAnalytics({ ...input, range: "30d" });
  const yesterday = week.days.at(-2);

  return {
    today,
    week,
    month,
    services: input.services.map((service) => {
      const tokens = input.tokens.filter(
        (token) => token.serviceId === service.serviceId,
      );
      const joinedOn = (day: string | undefined) =>
        tokens.filter((token) => token.queueDate === day).length;
      const todays = tokens.filter((token) => token.queueDate === input.today);
      return {
        ...service,
        joinedToday: todays.length,
        completedToday: todays.filter((token) => token.status === "COMPLETED")
          .length,
        joinedByDay: week.days.map(joinedOn),
        changeVsYesterday: todays.length - joinedOn(yesterday),
      };
    }),
  };
}
