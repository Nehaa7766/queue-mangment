import { describe, expect, it } from "vitest";
import {
  applyOptimistic,
  applyResult,
  startBlockedReason,
} from "@/components/doctor/doctor-panel-state";
import { panelView, staffToken } from "./fixtures";

const NOW_ISO = "2026-10-30T06:00:00.000Z";

describe("startBlockedReason", () => {
  it("allows starting when no consultation is in progress", () => {
    expect(startBlockedReason(panelView(), false)).toBeNull();
  });

  it("blocks while a consultation is in progress", () => {
    const view = panelView({
      current: staffToken({ id: "16", status: "IN_SERVICE" }),
    });
    expect(startBlockedReason(view, false)).toBe(
      "Complete your current consultation first.",
    );
  });

  it("blocks while a change is saving", () => {
    expect(startBlockedReason(panelView(), true)).toMatch(/saving/i);
  });
});

describe("applyOptimistic", () => {
  it("moves a started patient from ready into the consultation", () => {
    const next = applyOptimistic(
      panelView(),
      { type: "start", tokenId: "17" },
      NOW_ISO,
    );

    expect(next.called).toEqual([]);
    expect(next.current).toMatchObject({
      id: "17",
      status: "IN_SERVICE",
      serviceStartedAt: NOW_ISO,
      assignedDoctorName: "Dr. Shah",
    });
  });

  it("clears the consultation and counts it when completed", () => {
    const view = panelView({
      current: staffToken({ id: "16", status: "IN_SERVICE" }),
    });
    const next = applyOptimistic(
      view,
      { type: "complete", tokenId: "16" },
      NOW_ISO,
    );

    expect(next.current).toBeNull();
    expect(next.seenToday).toBe(4);
  });

  it("ignores actions on tokens it doesn't know", () => {
    const view = panelView();
    expect(
      applyOptimistic(view, { type: "start", tokenId: "99" }, NOW_ISO),
    ).toBe(view);
    expect(
      applyOptimistic(view, { type: "complete", tokenId: "99" }, NOW_ISO),
    ).toBe(view);
  });
});

describe("applyResult", () => {
  it("shows the server's token once a start succeeds", () => {
    const started = staffToken({
      id: "17",
      status: "IN_SERVICE",
      assignedDoctorName: "Dr. Shah",
    });
    const next = applyResult(panelView(), started);

    expect(next.current).toEqual(started);
    expect(next.called).toEqual([]);
  });

  it("clears the consultation once a complete succeeds", () => {
    const view = panelView({
      current: staffToken({ id: "16", status: "IN_SERVICE" }),
    });
    const next = applyResult(
      view,
      staffToken({ id: "16", status: "COMPLETED" }),
    );

    expect(next.current).toBeNull();
  });
});
