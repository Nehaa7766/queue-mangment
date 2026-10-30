import { describe, expect, it } from "vitest";
import {
  clinicToday,
  fromDbDate,
  isOpenNow,
  toDbDate,
} from "@/features/queue/clinic-time";

describe("clinicToday", () => {
  it("uses the clinic's calendar date, not UTC", () => {
    // 20:00 UTC on 29 Oct is 01:30 on 30 Oct in India.
    const now = new Date("2026-10-29T20:00:00Z");

    expect(clinicToday("Asia/Kolkata", now)).toBe("2026-10-30");
    expect(clinicToday("UTC", now)).toBe("2026-10-29");
  });

  it("round-trips through the DATE column representation", () => {
    expect(fromDbDate(toDbDate("2026-10-30"))).toBe("2026-10-30");
  });
});

describe("isOpenNow", () => {
  // Friday 30 Oct 2026, 10:30 in India.
  const fridayMorning = new Date("2026-10-30T05:00:00Z");
  const hours = {
    fri: [
      ["09:00", "13:00"],
      ["17:00", "20:00"],
    ],
  };

  it("treats a clinic without opening hours as open", () => {
    expect(isOpenNow(null, "Asia/Kolkata", fridayMorning)).toBe(true);
  });

  it("is open inside one of today's ranges", () => {
    expect(isOpenNow(hours, "Asia/Kolkata", fridayMorning)).toBe(true);
  });

  it("is closed between ranges and at the closing minute", () => {
    // 14:00 and 13:00 in India.
    expect(
      isOpenNow(hours, "Asia/Kolkata", new Date("2026-10-30T08:30:00Z")),
    ).toBe(false);
    expect(
      isOpenNow(hours, "Asia/Kolkata", new Date("2026-10-30T07:30:00Z")),
    ).toBe(false);
  });

  it("is closed on a day with no hours", () => {
    expect(
      isOpenNow({ mon: [["09:00", "13:00"]] }, "Asia/Kolkata", fridayMorning),
    ).toBe(false);
  });

  it("ignores malformed ranges", () => {
    expect(
      isOpenNow({ fri: [["09:00"], "all day"] }, "Asia/Kolkata", fridayMorning),
    ).toBe(false);
  });
});
