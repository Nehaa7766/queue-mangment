import { describe, expect, it } from "vitest";
import {
  buildAdminAnalytics,
  buildAdminDashboard,
  type AnalyticsToken,
} from "@/features/analytics/admin-analytics";
import {
  describeAction,
  parseAuditFilters,
} from "@/features/analytics/audit-log";
import {
  addDays,
  clinicDayBounds,
  daysEndingOn,
} from "@/features/analytics/range-time";

const at = (iso: string) => new Date(iso);

function token(overrides: Partial<AnalyticsToken>): AnalyticsToken {
  return {
    queueDate: "2026-10-30",
    serviceId: "general",
    serviceName: "General",
    status: "WAITING",
    walkIn: false,
    joinedAt: at("2026-10-30T04:00:00Z"),
    calledAt: null,
    serviceStartedAt: null,
    completedAt: null,
    ...overrides,
  };
}

describe("range helpers", () => {
  it("lists days ending on a date, across a month boundary", () => {
    expect(daysEndingOn("2026-11-02", 4)).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("finds a clinic day's bounds in UTC for India (UTC+5:30)", () => {
    const { start, end } = clinicDayBounds("2026-10-30", "Asia/Kolkata");

    expect(start.toISOString()).toBe("2026-10-29T18:30:00.000Z");
    expect(end.toISOString()).toBe("2026-10-30T18:30:00.000Z");
  });

  it("finds a UTC clinic's day bounds", () => {
    expect(clinicDayBounds("2026-10-30", "UTC").start.toISOString()).toBe(
      "2026-10-30T00:00:00.000Z",
    );
  });
});

describe("buildAdminAnalytics", () => {
  const tokens = [
    // Completed after a 10 minute wait and a 6 minute consultation.
    token({
      status: "COMPLETED",
      calledAt: at("2026-10-30T04:10:00Z"),
      serviceStartedAt: at("2026-10-30T04:12:00Z"),
      completedAt: at("2026-10-30T04:18:00Z"),
    }),
    // Walk-in, no-show after a 30 minute wait.
    token({
      status: "SKIPPED",
      walkIn: true,
      calledAt: at("2026-10-30T04:30:00Z"),
    }),
    // Still waiting: counts as joined, not in waits.
    token({}),
    // Yesterday, another service, cancelled.
    token({
      queueDate: "2026-10-29",
      serviceId: "dental",
      serviceName: "Dental",
      status: "CANCELLED",
    }),
    // Outside the 7-day range.
    token({ queueDate: "2026-10-01", status: "COMPLETED" }),
  ];

  it("totals today only", () => {
    const view = buildAdminAnalytics({
      range: "today",
      today: "2026-10-30",
      tokens,
    });

    expect(view.days).toEqual(["2026-10-30"]);
    expect(view.totals).toMatchObject({
      joined: 3,
      qrJoins: 2,
      walkIns: 1,
      completed: 1,
      noShows: 1,
      cancelled: 0,
      averageWaitMinutes: 20,
      medianWaitMinutes: 20,
      averageConsultationMinutes: 6,
      noShowRate: 50,
    });
  });

  it("buckets 7 days and splits by service", () => {
    const view = buildAdminAnalytics({
      range: "7d",
      today: "2026-10-30",
      tokens,
    });

    expect(view.daily).toHaveLength(7);
    expect(view.daily.at(-1)).toMatchObject({ date: "2026-10-30", joined: 3 });
    expect(view.daily.at(-2)).toMatchObject({
      date: "2026-10-29",
      joined: 1,
      cancelled: 1,
    });
    expect(view.totals.joined).toBe(4);
    expect(view.byService.map((row) => [row.serviceName, row.joined])).toEqual([
      ["General", 3],
      ["Dental", 1],
    ]);
  });

  it("reports no waits or rate when nothing has finished", () => {
    const view = buildAdminAnalytics({
      range: "today",
      today: "2026-10-30",
      tokens: [token({})],
    });

    expect(view.totals.averageWaitMinutes).toBeNull();
    expect(view.totals.medianWaitMinutes).toBeNull();
    expect(view.totals.noShowRate).toBeNull();
  });
});

describe("buildAdminDashboard", () => {
  const services = [
    { serviceId: "general", serviceName: "General", tokenPrefix: "A" },
    { serviceId: "dental", serviceName: "Dental", tokenPrefix: "C" },
    // Active but nobody has joined yet: still gets a card.
    { serviceId: "eye", serviceName: "Eye", tokenPrefix: "E" },
  ];
  const tokens = [
    token({ status: "COMPLETED" }),
    token({ status: "WAITING" }),
    token({ queueDate: "2026-10-29" }),
    token({ queueDate: "2026-10-29" }),
    token({ queueDate: "2026-10-29" }),
    token({ queueDate: "2026-10-29", serviceId: "dental" }),
    // 20 days ago: in the month, not the week.
    token({ queueDate: "2026-10-10", status: "COMPLETED" }),
  ];

  it("builds today, 7-day and 30-day views from one set of tokens", () => {
    const view = buildAdminDashboard({
      today: "2026-10-30",
      tokens,
      services,
    });

    expect(view.today.totals.joined).toBe(2);
    expect(view.week.totals.joined).toBe(6);
    expect(view.month.totals.joined).toBe(7);
    expect(view.month.totals.completed).toBe(2);
    expect(view.month.daily).toHaveLength(30);
  });

  it("gives every active service a 7-day trend and today's change", () => {
    const [general, dental, eye] = buildAdminDashboard({
      today: "2026-10-30",
      tokens,
      services,
    }).services;

    expect(general).toMatchObject({
      tokenPrefix: "A",
      joinedToday: 2,
      completedToday: 1,
      joinedByDay: [0, 0, 0, 0, 0, 3, 2],
      changeVsYesterday: -1,
    });
    expect(dental).toMatchObject({ joinedToday: 0, changeVsYesterday: -1 });
    expect(eye).toMatchObject({
      joinedToday: 0,
      joinedByDay: [0, 0, 0, 0, 0, 0, 0],
      changeVsYesterday: 0,
    });
  });
});

describe("audit labels and filters", () => {
  it("labels known actions and still reads new ones", () => {
    expect(describeAction("staff.role_changed")).toBe("Role changed");
    expect(describeAction("doctor.availability_changed")).toBe(
      "Doctor availability changed",
    );
  });

  it("ignores malformed filters", () => {
    expect(
      parseAuditFilters({
        date: "yesterday",
        actor: "1 OR 1=1",
        category: "staff",
      }),
    ).toEqual({ date: undefined, actorUserId: undefined, category: "staff" });
  });
});
