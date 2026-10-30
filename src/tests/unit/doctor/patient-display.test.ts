import { describe, expect, it } from "vitest";
import {
  completionsPerHour,
  durationMinutes,
  timeRange,
} from "@/components/doctor/patient-display";

const HOUR = 3_600_000;
const START = Date.parse("2026-10-30T04:00:00Z");

describe("completionsPerHour", () => {
  it("counts finished consultations per hour since the first one", () => {
    const at = (offset: number) => ({
      completedAt: new Date(START + offset).toISOString(),
    });

    expect(
      completionsPerHour(
        [at(0), at(10 * 60_000), at(2 * HOUR + 5 * 60_000)],
        START + 2 * HOUR + 30 * 60_000,
      ),
    ).toEqual([2, 0, 1]);
  });

  it("is empty before the first consultation", () => {
    expect(completionsPerHour([], START)).toEqual([]);
  });
});

describe("consultation times", () => {
  const token = {
    serviceStartedAt: "2026-10-30T05:30:00Z",
    completedAt: "2026-10-30T05:42:00Z",
  };

  it("gives the length in whole minutes", () => {
    expect(durationMinutes(token)).toBe(12);
    expect(durationMinutes({ ...token, completedAt: null })).toBeNull();
  });

  it("prints the start and end in the clinic's timezone", () => {
    expect(timeRange(token, "Asia/Kolkata")).toBe("11:00–11:12");
  });
});
