import type { QueueStatus } from "@/features/queue/queue-rules";
import type { TokenStatus } from "@/features/queue/token-status";
import { clinicHour, clinicTime, minutesBetween } from "./clinic-time";

// Receptionist dashboard (docs/PLAN.md §12.7). Built from today's tokens in
// memory: a clinic day is at most a few hundred tokens.

export type ActivityKind =
  | "joined"
  | "walkIn"
  | "called"
  | "recalled"
  | "skipped"
  | "requeued"
  | "cancelled"
  | "started"
  | "completed"
  | "paused"
  | "resumed"
  | "closed"
  | "other";

export type DashboardToken = {
  id: string;
  queueId: string;
  serviceId: string;
  serviceName: string;
  tokenLabel: string;
  patientName: string | null;
  status: TokenStatus;
  sortKey: number;
  joinedAt: Date;
  calledAt: Date | null;
  completedAt: Date | null;
  skippedAt: Date | null;
  cancelledAt: Date | null;
};

export type DashboardQueue = {
  queueId: string;
  serviceId: string;
  serviceName: string;
  tokenPrefix: string;
  status: QueueStatus;
};

export type DashboardEvent = {
  id: string;
  action: string;
  newState: string | null;
  tokenLabel: string | null;
  actorName: string | null;
  createdAt: Date;
};

export type CompactToken = {
  id: string;
  tokenLabel: string;
  patientName: string | null;
  serviceName: string;
  status: TokenStatus;
  joinedAt: string;
  calledAt: string | null;
};

export type DashboardView = {
  clinic: { id: string; name: string; timezone: string };
  queueDate: string;
  generatedAt: string;
  waitTargetMinutes: number;
  kpis: {
    waitingNow: number;
    waitingLastHour: number;
    servedToday: number;
    // Null until someone has been called today.
    averageWaitMinutes: number | null;
    noShowsToday: number;
    // Everyone called today, for the no-show rate.
    calledToday: number;
    // Every token today except cancelled ones, for the served share.
    totalToday: number;
  };
  // One point per clinic hour, from the first arrival (or now) to now.
  flow: {
    hour: string;
    // Waiting at the end of the hour.
    waiting: number;
    // Joined and finished consultations during the hour.
    joined: number;
    served: number;
    averageWaitMinutes: number | null;
  }[];
  // Today's queues, one trend card each.
  queues: {
    queueId: string;
    serviceName: string;
    tokenPrefix: string;
    status: QueueStatus;
    waiting: number;
    served: number;
    total: number;
    // Served per hour, aligned with flow.
    servedByHour: number[];
  }[];
  waitingByService: {
    serviceId: string;
    serviceName: string;
    waiting: number;
  }[];
  recentActivity: {
    id: string;
    kind: ActivityKind;
    title: string;
    detail: string | null;
    time: string;
    createdAt: string;
  }[];
  // The busiest queue, for the compact queue card.
  queueCard: {
    queueId: string;
    serviceName: string;
    status: QueueStatus;
    waitingCount: number;
    nowServing: CompactToken | null;
    upNext: CompactToken[];
  } | null;
};

const HOUR_MS = 60 * 60 * 1000;

// Approximation from timestamps: a token that was skipped and then
// requeued is counted as gone from the moment it was first skipped.
function wasWaitingAt(token: DashboardToken, at: Date): boolean {
  const left = [token.calledAt, token.skippedAt, token.cancelledAt].some(
    (time) => time !== null && time <= at,
  );
  return token.joinedAt <= at && !left;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

function waitMinutes(token: DashboardToken): number | null {
  return token.calledAt ? minutesBetween(token.joinedAt, token.calledAt) : null;
}

function toCompact(token: DashboardToken): CompactToken {
  return {
    id: token.id,
    tokenLabel: token.tokenLabel,
    patientName: token.patientName,
    serviceName: token.serviceName,
    status: token.status,
    joinedAt: token.joinedAt.toISOString(),
    calledAt: token.calledAt?.toISOString() ?? null,
  };
}

// Audit actions are dotted verbs ("token.called", "queue.paused"); match on
// the verb so new prefixes keep working.
export function activityKind(
  action: string,
  actorName: string | null,
): ActivityKind {
  const verb = action.toLowerCase();
  if (verb.includes("pause")) return "paused";
  if (verb.includes("resume")) return "resumed";
  if (verb.includes("close")) return "closed";
  if (verb.includes("recall")) return "recalled";
  if (verb.includes("requeue")) return "requeued";
  if (verb.includes("call")) return "called";
  if (verb.includes("skip")) return "skipped";
  if (verb.includes("cancel")) return "cancelled";
  if (verb.includes("start")) return "started";
  if (verb.includes("complete")) return "completed";
  if (verb.includes("walk")) return "walkIn";
  if (verb.includes("join") || verb.includes("creat")) {
    // Staff-created tokens are walk-ins; QR joins have no actor.
    return actorName ? "walkIn" : "joined";
  }
  return "other";
}

const ACTIVITY_TITLES: Record<ActivityKind, string> = {
  joined: "Joined by QR code",
  walkIn: "Walk-in registered",
  called: "Token called",
  recalled: "Token recalled",
  skipped: "Marked as no-show",
  requeued: "Moved back to the queue",
  cancelled: "Token cancelled",
  started: "Consultation started",
  completed: "Consultation completed",
  paused: "Queue paused",
  resumed: "Queue resumed",
  closed: "Queue closed",
  other: "Queue updated",
};

export function buildDashboard(input: {
  clinic: { id: string; name: string; timezone: string };
  queueDate: string;
  waitTargetMinutes: number;
  queues: DashboardQueue[];
  tokens: DashboardToken[];
  events: DashboardEvent[];
  now: Date;
}): DashboardView {
  const { clinic, queues, tokens, events, now } = input;
  const timeZone = clinic.timezone;
  const waiting = tokens.filter((token) => token.status === "WAITING");

  const waitTimes = tokens
    .map(waitMinutes)
    .filter((minutes): minutes is number => minutes !== null);

  // Hourly flow from the first arrival's hour to the current hour.
  const currentHour = clinicHour(now, timeZone);
  const firstHour = tokens.reduce(
    (earliest, token) =>
      Math.min(earliest, clinicHour(token.joinedAt, timeZone)),
    currentHour,
  );
  // Start of the current clinic hour. Uses the clinic's minutes because some
  // timezones (Asia/Kolkata is UTC+5:30) don't start hours on UTC hours.
  const minutesIntoHour = Number(clinicTime(now, timeZone).slice(3));
  const hourStart =
    now.getTime() -
    minutesIntoHour * 60_000 -
    now.getUTCSeconds() * 1000 -
    now.getUTCMilliseconds();
  // Whether a timestamp falls in the given clinic hour, up to now.
  const inHour = (time: Date | null, hour: number) =>
    time !== null && time <= now && clinicHour(time, timeZone) === hour;

  const hours: number[] = [];
  for (let hour = firstHour; hour <= currentHour; hour++) hours.push(hour);

  const flow = hours.map((hour) => {
    const hoursAgo = currentHour - hour;
    // End of that hour, or now for the current hour.
    const at =
      hoursAgo === 0 ? now : new Date(hourStart - (hoursAgo - 1) * HOUR_MS);
    const calledThisHour = tokens.filter((token) =>
      inHour(token.calledAt, hour),
    );
    return {
      hour: `${String(hour).padStart(2, "0")}:00`,
      waiting: tokens.filter((token) => wasWaitingAt(token, at)).length,
      joined: tokens.filter((token) => inHour(token.joinedAt, hour)).length,
      served: tokens.filter((token) => inHour(token.completedAt, hour)).length,
      averageWaitMinutes: average(
        calledThisHour
          .map(waitMinutes)
          .filter((minutes): minutes is number => minutes !== null),
      ),
    };
  });

  const queueSummaries = queues.map((queue) => {
    const inQueue = tokens.filter((token) => token.queueId === queue.queueId);
    return {
      queueId: queue.queueId,
      serviceName: queue.serviceName,
      tokenPrefix: queue.tokenPrefix,
      status: queue.status,
      waiting: inQueue.filter((token) => token.status === "WAITING").length,
      served: inQueue.filter((token) => token.status === "COMPLETED").length,
      total: inQueue.filter((token) => token.status !== "CANCELLED").length,
      servedByHour: hours.map(
        (hour) =>
          inQueue.filter((token) => inHour(token.completedAt, hour)).length,
      ),
    };
  });

  const waitingByService = queues.map((queue) => ({
    serviceId: queue.serviceId,
    serviceName: queue.serviceName,
    waiting: waiting.filter((token) => token.queueId === queue.queueId).length,
  }));

  const busiest = [...queues].sort(
    (a, b) =>
      waiting.filter((t) => t.queueId === b.queueId).length -
        waiting.filter((t) => t.queueId === a.queueId).length ||
      a.serviceName.localeCompare(b.serviceName),
  )[0];

  let queueCard: DashboardView["queueCard"] = null;
  if (busiest) {
    const inQueue = tokens.filter((token) => token.queueId === busiest.queueId);
    const nowServing = inQueue
      .filter(
        (token) => token.status === "CALLED" || token.status === "IN_SERVICE",
      )
      .sort(
        (a, b) => (b.calledAt?.getTime() ?? 0) - (a.calledAt?.getTime() ?? 0),
      )[0];
    const upNext = inQueue
      .filter((token) => token.status === "WAITING")
      .sort((a, b) => a.sortKey - b.sortKey);
    queueCard = {
      queueId: busiest.queueId,
      serviceName: busiest.serviceName,
      status: busiest.status,
      waitingCount: upNext.length,
      nowServing: nowServing ? toCompact(nowServing) : null,
      upNext: upNext.slice(0, 4).map(toCompact),
    };
  }

  return {
    clinic,
    queueDate: input.queueDate,
    generatedAt: now.toISOString(),
    waitTargetMinutes: input.waitTargetMinutes,
    kpis: {
      waitingNow: waiting.length,
      waitingLastHour: tokens.filter((token) =>
        wasWaitingAt(token, new Date(now.getTime() - HOUR_MS)),
      ).length,
      servedToday: tokens.filter((token) => token.status === "COMPLETED")
        .length,
      averageWaitMinutes: average(waitTimes),
      noShowsToday: tokens.filter((token) => token.skippedAt !== null).length,
      calledToday: tokens.filter((token) => token.calledAt !== null).length,
      totalToday: tokens.filter((token) => token.status !== "CANCELLED").length,
    },
    flow,
    queues: queueSummaries,
    waitingByService,
    recentActivity: events.map((event) => {
      const kind = activityKind(event.action, event.actorName);
      const detail = [event.tokenLabel, event.actorName]
        .filter(Boolean)
        .join(" · ");
      return {
        id: event.id,
        kind,
        title: ACTIVITY_TITLES[kind],
        detail: detail || null,
        time: clinicTime(event.createdAt, timeZone),
        createdAt: event.createdAt.toISOString(),
      };
    }),
    queueCard,
  };
}
