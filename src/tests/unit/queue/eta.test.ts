import { describe, expect, it } from "vitest";
import { estimateWait } from "@/features/queue/eta";

const base = {
  peopleAhead: 4,
  serviceMinutes: 10,
  recentDurationsMinutes: [] as number[],
  activeDoctors: 1,
};

describe("estimateWait", () => {
  it("uses the service estimate and marks it rough with too few samples", () => {
    // 4 × 10 = 40 → 30–50
    expect(
      estimateWait({ ...base, recentDurationsMinutes: [8, 9, 12, 11] }),
    ).toEqual({ minMinutes: 30, maxMinutes: 50, isRough: true });
  });

  it("uses the median of recent durations with enough samples", () => {
    // median of [6, 7, 8, 30, 40] is 8 → 4 × 8 = 32 → 20–40
    expect(
      estimateWait({ ...base, recentDurationsMinutes: [40, 6, 30, 8, 7] }),
    ).toEqual({ minMinutes: 20, maxMinutes: 40, isRough: false });
  });

  it("averages the two middle samples for an even count", () => {
    // median of [5, 6, 8, 10, 12, 14] is 9 → 4 × 9 = 36 → 25–45
    expect(
      estimateWait({
        ...base,
        recentDurationsMinutes: [14, 5, 12, 6, 10, 8],
      }),
    ).toEqual({ minMinutes: 25, maxMinutes: 45, isRough: false });
  });

  it("ignores invalid samples", () => {
    const estimate = estimateWait({
      ...base,
      recentDurationsMinutes: [10, 10, 10, 10, 0, -5, Number.NaN],
    });
    expect(estimate.isRough).toBe(true);
  });

  it("splits the wait across active doctors", () => {
    // 4 × 10 ÷ 2 = 20 → 15–25
    expect(estimateWait({ ...base, activeDoctors: 2 })).toEqual({
      minMinutes: 15,
      maxMinutes: 25,
      isRough: true,
    });
  });

  it("treats zero doctors as one", () => {
    expect(estimateWait({ ...base, activeDoctors: 0 })).toEqual(
      estimateWait(base),
    );
  });

  it("still gives a range when nobody is ahead", () => {
    expect(estimateWait({ ...base, peopleAhead: 0 })).toEqual({
      minMinutes: 0,
      maxMinutes: 5,
      isRough: true,
    });
  });

  it("treats a negative count as nobody ahead", () => {
    expect(estimateWait({ ...base, peopleAhead: -2 })).toEqual(
      estimateWait({ ...base, peopleAhead: 0 }),
    );
  });

  it("never returns a single number or an inverted range", () => {
    for (let peopleAhead = 0; peopleAhead <= 30; peopleAhead++) {
      for (const serviceMinutes of [1, 3, 7, 12, 25]) {
        for (const activeDoctors of [1, 2, 3]) {
          const { minMinutes, maxMinutes } = estimateWait({
            ...base,
            peopleAhead,
            serviceMinutes,
            activeDoctors,
          });
          expect(minMinutes).toBeGreaterThanOrEqual(0);
          expect(maxMinutes).toBeGreaterThan(minMinutes);
          expect(minMinutes % 5).toBe(0);
          expect(maxMinutes % 5).toBe(0);
        }
      }
    }
  });
});
