import { describe, expect, it } from "vitest";
import {
  applyOptimistic,
  callNextBlockedReason,
  nowServingToken,
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

  it("skip moves the token to recent as a no-show", () => {
    const view = applyOptimistic(
      queueView(),
      { type: "skip", tokenId: "17" },
      NOW_ISO,
    );

    expect(view.current).toHaveLength(0);
    expect(view.recent[0]).toMatchObject({ id: "17", status: "SKIPPED" });
  });

  it("requeue puts a skipped token at the back of the queue", () => {
    const base = queueView({
      recent: [staffToken({ id: "15", status: "SKIPPED" })],
    });

    const view = applyOptimistic(
      base,
      { type: "requeue", tokenId: "15" },
      NOW_ISO,
    );

    expect(view.waiting.map((t) => t.id)).toEqual(["18", "19", "15"]);
    expect(view.recent).toHaveLength(0);
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
