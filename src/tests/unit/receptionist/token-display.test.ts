import { describe, expect, it } from "vitest";
import { formatClock } from "@/components/queue/token-display";

describe("formatClock", () => {
  it("shows minutes and seconds under an hour", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(102)).toBe("1:42");
    expect(formatClock(3599)).toBe("59:59");
  });

  it("switches to hours and minutes from an hour up", () => {
    expect(formatClock(3600)).toBe("1h 00m");
    expect(formatClock(68_559)).toBe("19h 02m");
  });

  it("never goes below zero", () => {
    expect(formatClock(-5)).toBe("0:00");
  });
});
