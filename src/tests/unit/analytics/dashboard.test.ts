import { describe, expect, it } from "vitest";
import {
  clinicDate,
  clinicHour,
  clinicTime,
} from "@/features/analytics/clinic-time";
import {
  activityKind,
  buildDashboard,
  type DashboardToken,
} from "@/features/analytics/dashboard";

const TZ = "Asia/Kolkata"; // UTC+5:30
const NOW = new Date("2026-10-30T06:20:00Z"); // 11:50 in the clinic

function token(
  overrides: Partial<DashboardToken> & Pick<DashboardToken, "id" | "joinedAt">,
): DashboardToken {
  return {
    queueId: "queue-a",
    serviceId: "service-a",
    serviceName: "General",
    tokenLabel: overrides.id.toUpperCase(),
    patientName: null,
    status: "WAITING",
    sortKey: 1,
    calledAt: null,
    completedAt: null,
    skippedAt: null,
    cancelledAt: null,
    ...overrides,
  };
}

const at = (iso: string) => new Date(iso);

const TOKENS: DashboardToken[] = [
  // Waited 20 min, served.
  token({
    id: "t1",
    sortKey: 1,
    joinedAt: at("2026-10-30T03:40:00Z"),
    calledAt: at("2026-10-30T04:00:00Z"),
    completedAt: at("2026-10-30T04:20:00Z"),
    status: "COMPLETED",
  }),
  // Waited 50 min, no-show.
  token({
    id: "t2",
    sortKey: 2,
    joinedAt: at("2026-10-30T04:10:00Z"),
    calledAt: at("2026-10-30T05:00:00Z"),
    skippedAt: at("2026-10-30T05:06:00Z"),
    status: "SKIPPED",
  }),
  // Waited 70 min, called now.
  token({
    id: "t3",
    sortKey: 3,
    joinedAt: at("2026-10-30T05:00:00Z"),
    calledAt: at("2026-10-30T06:10:00Z"),
    status: "CALLED",
  }),
  token({ id: "t4", sortKey: 4, joinedAt: at("2026-10-30T05:40:00Z") }),
  token({
    id: "t6",
    sortKey: 6,
    joinedAt: at("2026-10-30T04:30:00Z"),
    cancelledAt: at("2026-10-30T04:45:00Z"),
    status: "CANCELLED",
  }),
  token({
    id: "t5",
    queueId: "queue-b",
    serviceId: "service-b",
    serviceName: "Pediatrics",
    sortKey: 1,
    joinedAt: at("2026-10-30T06:00:00Z"),
  }),
];

function build(tokens = TOKENS) {
  return buildDashboard({
    clinic: { id: "clinic", name: "Demo", timezone: TZ },
    queueDate: "2026-10-30",
    waitTargetMinutes: 20,
    now: NOW,
    queues: [
      {
        queueId: "queue-a",
        serviceId: "service-a",
        serviceName: "General",
        tokenPrefix: "A",
        status: "OPEN",
      },
      {
        queueId: "queue-b",
        serviceId: "service-b",
        serviceName: "Pediatrics",
        tokenPrefix: "B",
        status: "OPEN",
      },
    ],
    tokens,
    events: [],
  });
}

describe("clinic time", () => {
  it("uses the clinic's wall clock, including half-hour offsets", () => {
    expect(clinicDate(at("2026-10-29T19:00:00Z"), TZ)).toBe("2026-10-30");
    expect(clinicHour(NOW, TZ)).toBe(11);
    expect(clinicTime(NOW, TZ)).toBe("11:50");
  });
});

describe("buildDashboard", () => {
  it("computes today's KPIs", () => {
    expect(build().kpis).toEqual({
      waitingNow: 2,
      // At 10:50 only t3 was waiting.
      waitingLastHour: 1,
      servedToday: 1,
      // (20 + 50 + 70) / 3, rounded.
      averageWaitMinutes: 47,
      noShowsToday: 1,
      // t1, t2 and t3 were called.
      calledToday: 3,
      // Everyone except the cancelled t6.
      totalToday: 5,
    });
  });

  it("builds one flow point per clinic hour, measured at the end of each hour", () => {
    expect(build().flow).toEqual([
      // t1 and t2 joined; t1 was served at 09:50.
      {
        hour: "09:00",
        waiting: 2,
        joined: 2,
        served: 1,
        averageWaitMinutes: 20,
      },
      // t6 (later cancelled) and t3 joined.
      {
        hour: "10:00",
        waiting: 1,
        joined: 2,
        served: 0,
        averageWaitMinutes: 50,
      },
      {
        hour: "11:00",
        waiting: 2,
        joined: 2,
        served: 0,
        averageWaitMinutes: 70,
      },
    ]);
  });

  it("summarises each queue for its trend card", () => {
    expect(build().queues).toEqual([
      {
        queueId: "queue-a",
        serviceName: "General",
        tokenPrefix: "A",
        status: "OPEN",
        waiting: 1,
        served: 1,
        // The cancelled t6 doesn't count.
        total: 4,
        servedByHour: [1, 0, 0],
      },
      {
        queueId: "queue-b",
        serviceName: "Pediatrics",
        tokenPrefix: "B",
        status: "OPEN",
        waiting: 1,
        served: 0,
        total: 1,
        servedByHour: [0, 0, 0],
      },
    ]);
  });

  it("counts waiting patients per service", () => {
    expect(build().waitingByService).toEqual([
      { serviceId: "service-a", serviceName: "General", waiting: 1 },
      { serviceId: "service-b", serviceName: "Pediatrics", waiting: 1 },
    ]);
  });

  it("puts the busiest queue on the queue card, in FIFO order", () => {
    const card = build().queueCard;
    expect(card?.serviceName).toBe("General");
    expect(card?.nowServing?.tokenLabel).toBe("T3");
    expect(card?.upNext.map((t) => t.tokenLabel)).toEqual(["T4"]);
    expect(card?.waitingCount).toBe(1);
  });

  it("handles an empty day", () => {
    const view = build([]);
    expect(view.kpis.averageWaitMinutes).toBeNull();
    expect(view.flow).toEqual([
      {
        hour: "11:00",
        waiting: 0,
        joined: 0,
        served: 0,
        averageWaitMinutes: null,
      },
    ]);
    expect(view.queueCard?.nowServing).toBeNull();
    expect(view.kpis.totalToday).toBe(0);
    expect(view.queues.map((queue) => queue.servedByHour)).toEqual([[0], [0]]);
  });
});

describe("activityKind", () => {
  it.each([
    ["token.called", null, "called"],
    ["token.recalled", "Neha", "recalled"],
    ["token.skipped", "Neha", "skipped"],
    ["token.requeued", "Neha", "requeued"],
    ["token.cancelled", null, "cancelled"],
    ["token.joined", null, "joined"],
    ["token.walk_in_registered", "Neha", "walkIn"],
    ["consultation.started", "Dr. Shah", "started"],
    ["consultation.completed", "Dr. Shah", "completed"],
    ["queue.paused", "Neha", "paused"],
    ["queue.resumed", "Neha", "resumed"],
    ["queue.closed", "Neha", "closed"],
    ["something.else", null, "other"],
  ] as const)("maps %s", (action, actor, kind) => {
    expect(activityKind(action, actor)).toBe(kind);
  });
});
