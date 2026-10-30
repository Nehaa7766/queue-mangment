import { describe, expect, it } from "vitest";
import {
  applyOptimistic,
  callNextBlockedReason,
  nowServingToken,
  queueTabGroups,
  upsertToken,
} from "@/components/queue/live-queue-state";
import { queueView, staffToken } from "./fixtures";

const NOW_ISO = "2026-10-30T06:00:00.000Z";

describe("applyOptimistic", () => {
  it("call next moves the first waiting token to current", () => {
    const view = applyOptimistic(queueView(), { type: "callNext" }, NOW_ISO);

    expect(view.waiting.map((t) => t.id)).toEqual(["19"]);
    expect(view.current.find((t) => t.id === "18")).toMatchObject({
      status: "CALLED",
      calledAt: NOW_ISO,
    });
    expect(view.queue.waitingCount).toBe(1);
  });

  it("recall restarts the grace period and counts the recall", () => {
    const view = applyOptimistic(
      queueView(),
      { type: "recall", tokenId: "17" },
      NOW_ISO,
    );

    expect(view.current[0]).toMatchObject({
      id: "17",
      calledAt: NOW_ISO,
      recallCount: 1,
    });
  });

  it("skip moves the token to recent and today's no-shows", () => {
    const earlier = staffToken({ id: "12", status: "CANCELLED" });
    const view = applyOptimistic(
      queueView({ missedToday: [earlier] }),
      { type: "skip", tokenId: "17" },
      NOW_ISO,
    );

    expect(view.current).toHaveLength(0);
    expect(view.recent[0]).toMatchObject({ id: "17", status: "SKIPPED" });
    expect(view.missedToday.map((t) => t.id)).toEqual(["17", "12"]);
    expect(view.completedToday).toHaveLength(0);
  });

  it("requeue puts a skipped token at the back of the queue", () => {
    const skipped = staffToken({ id: "15", status: "SKIPPED" });
    const base = queueView({ recent: [skipped], missedToday: [skipped] });

    const view = applyOptimistic(
      base,
      { type: "requeue", tokenId: "15" },
      NOW_ISO,
    );

    expect(view.waiting.map((t) => t.id)).toEqual(["18", "19", "15"]);
    expect(view.recent).toHaveLength(0);
    expect(view.missedToday).toHaveLength(0);
  });

  it("requeues a no-show that is only in today's list", () => {
    const base = queueView({
      missedToday: [staffToken({ id: "9", status: "SKIPPED" })],
    });

    const view = applyOptimistic(
      base,
      { type: "requeue", tokenId: "9" },
      NOW_ISO,
    );

    expect(view.waiting.at(-1)).toMatchObject({ id: "9", status: "WAITING" });
    expect(view.missedToday).toHaveLength(0);
  });

  it("pause and resume change the queue status", () => {
    const paused = applyOptimistic(queueView(), { type: "pause" }, NOW_ISO);
    expect(paused.queue.status).toBe("PAUSED");
    expect(
      applyOptimistic(paused, { type: "resume" }, NOW_ISO).queue.status,
    ).toBe("OPEN");
  });

  it("ignores tokens it can't find", () => {
    const base = queueView();
    expect(
      applyOptimistic(base, { type: "skip", tokenId: "nope" }, NOW_ISO),
    ).toBe(base);
  });
});

describe("upsertToken", () => {
  it("files a server token under its status", () => {
    const done = upsertToken(
      queueView(),
      staffToken({ id: "17", status: "COMPLETED" }),
    );
    expect(done.current).toHaveLength(0);
    expect(done.recent[0].id).toBe("17");
  });

  it("puts a completed token at the top of today's completed list", () => {
    const earlier = staffToken({ id: "12", status: "COMPLETED" });
    const done = upsertToken(
      queueView({ completedToday: [earlier] }),
      staffToken({ id: "17", status: "COMPLETED" }),
    );

    expect(done.completedToday.map((t) => t.id)).toEqual(["17", "12"]);
    expect(done.missedToday).toHaveLength(0);
  });
});

describe("queueTabGroups", () => {
  const view = queueView({
    current: [
      staffToken({
        id: "15",
        status: "IN_SERVICE",
        calledAt: "2026-10-30T05:40:00Z",
        serviceStartedAt: "2026-10-30T05:45:00Z",
      }),
      staffToken({
        id: "14",
        status: "IN_SERVICE",
        calledAt: "2026-10-30T05:35:00Z",
        serviceStartedAt: "2026-10-30T05:38:00Z",
      }),
      staffToken({
        id: "16",
        status: "CALLED",
        calledAt: "2026-10-30T05:50:00Z",
      }),
      staffToken({
        id: "17",
        status: "CALLED",
        calledAt: "2026-10-30T05:55:00Z",
      }),
    ],
    completedToday: [
      staffToken({ id: "13", status: "COMPLETED" }),
      staffToken({ id: "11", status: "COMPLETED" }),
    ],
    missedToday: [
      staffToken({ id: "12", status: "SKIPPED" }),
      staffToken({ id: "10", status: "CANCELLED" }),
    ],
  });

  it("groups today's patients by stage, leaving the ticket's token out of Up next", () => {
    const groups = queueTabGroups(view, "17");

    expect(groups.called.map((t) => t.id)).toEqual(["16"]);
    expect(groups.waiting.map((t) => t.id)).toEqual(["18", "19"]);
    // Earliest start first.
    expect(groups.inService.map((t) => t.id)).toEqual(["14", "15"]);
    expect(groups.completed.map((t) => t.id)).toEqual(["13", "11"]);
    expect(groups.missed.map((t) => t.id)).toEqual(["12", "10"]);
  });

  it("counts each tab", () => {
    expect(queueTabGroups(view, "17").counts).toEqual({
      upNext: 3,
      inService: 2,
      completed: 2,
      missed: 2,
    });
    // With nobody on the ticket, every called patient is under Up next.
    expect(queueTabGroups(view, null).counts.upNext).toBe(4);
  });

  it("moves the counts as soon as reception skips someone", () => {
    const skipped = applyOptimistic(
      view,
      { type: "skip", tokenId: "16" },
      NOW_ISO,
    );

    expect(queueTabGroups(skipped, "17").counts).toMatchObject({
      upNext: 2,
      missed: 3,
    });
  });

  it("moves a patient from In consultation to Completed when the doctor finishes", () => {
    const finished = upsertToken(
      view,
      staffToken({
        id: "14",
        status: "COMPLETED",
        serviceStartedAt: "2026-10-30T05:38:00Z",
        completedAt: "2026-10-30T05:52:00Z",
      }),
    );
    const groups = queueTabGroups(finished, "17");

    expect(groups.inService.map((t) => t.id)).toEqual(["15"]);
    expect(groups.completed.map((t) => t.id)).toEqual(["14", "13", "11"]);
    expect(groups.counts).toMatchObject({ inService: 1, completed: 3 });
  });
});

describe("callNextBlockedReason", () => {
  it("allows calling when the queue is open and someone is waiting", () => {
    expect(callNextBlockedReason(queueView(), false)).toBeNull();
  });

  it.each([
    [queueView({ queue: { status: "PAUSED" } as never }), /paused/],
    [queueView({ queue: { status: "CLOSED" } as never }), /closed/],
    [queueView({ waiting: [] }), /No one is waiting/],
  ])("explains why calling is blocked", (view, reason) => {
    expect(callNextBlockedReason(view, false)).toMatch(reason);
  });

  it("blocks a second call while one is in flight", () => {
    expect(callNextBlockedReason(queueView(), true)).toMatch(/Calling/);
  });
});

describe("nowServingToken", () => {
  it("prefers the latest called patient over one with a doctor", () => {
    const view = queueView({
      current: [
        staffToken({
          id: "15",
          status: "IN_SERVICE",
          calledAt: "2026-10-30T05:59:00Z",
        }),
        staffToken({
          id: "16",
          status: "CALLED",
          calledAt: "2026-10-30T05:50:00Z",
        }),
        staffToken({
          id: "17",
          status: "CALLED",
          calledAt: "2026-10-30T05:55:00Z",
        }),
      ],
    });
    expect(nowServingToken(view)?.id).toBe("17");
  });

  it("falls back to the patient with a doctor, then to nobody", () => {
    expect(
      nowServingToken(
        queueView({
          current: [staffToken({ id: "15", status: "IN_SERVICE" })],
        }),
      )?.id,
    ).toBe("15");
    expect(nowServingToken(queueView({ current: [] }))).toBeNull();
  });
});
