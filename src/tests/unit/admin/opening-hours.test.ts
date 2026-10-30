import { describe, expect, it } from "vitest";
import {
  fromHoursForm,
  openingHoursSchema,
  toHoursForm,
  validateHoursForm,
  type HoursForm,
} from "@/features/clinics/opening-hours";
import { isOpenNow } from "@/features/queue/clinic-time";

// 10:30 on Monday 26 Oct 2026 in Asia/Kolkata (UTC+5:30).
const MONDAY_1030_IST = new Date("2026-10-26T05:00:00.000Z");
// 10:30 on Sunday 25 Oct 2026 in Asia/Kolkata.
const SUNDAY_1030_IST = new Date("2026-10-25T05:00:00.000Z");

function formWith(change: (form: HoursForm) => void): HoursForm {
  const form = toHoursForm({});
  form.enabled = true;
  change(form);
  return form;
}

describe("opening hours editor model", () => {
  it("treats no stored hours as always open, and saves null when switched off", () => {
    const form = toHoursForm(null);

    expect(form.enabled).toBe(false);
    expect(fromHoursForm(form)).toBeNull();
  });

  it("reads stored hours and writes back the exact format isOpenNow reads", () => {
    const stored = {
      mon: [
        ["09:00", "13:00"],
        ["17:00", "20:00"],
      ],
    };
    const form = toHoursForm(stored);

    expect(form.enabled).toBe(true);
    expect(form.days.mon.open).toBe(true);
    expect(form.days.tue.open).toBe(false);

    const saved = fromHoursForm(form);
    expect(saved).toEqual(stored);
    expect(isOpenNow(saved, "Asia/Kolkata", MONDAY_1030_IST)).toBe(true);
    expect(isOpenNow(saved, "Asia/Kolkata", SUNDAY_1030_IST)).toBe(false);
  });

  it("sorts each day's ranges and leaves closed days out", () => {
    const form = formWith((value) => {
      value.days.mon = {
        open: true,
        ranges: [
          { start: "17:00", end: "20:00" },
          { start: "09:00", end: "13:00" },
        ],
      };
      value.days.sun.open = false;
    });

    const saved = fromHoursForm(form);
    expect(saved?.mon).toEqual([
      ["09:00", "13:00"],
      ["17:00", "20:00"],
    ]);
    expect(saved).not.toHaveProperty("sun");
    expect(openingHoursSchema.safeParse(saved).success).toBe(true);
  });

  it("rejects a closing time before the opening time", () => {
    const form = formWith((value) => {
      value.days.tue = {
        open: true,
        ranges: [{ start: "18:00", end: "09:00" }],
      };
    });

    expect(validateHoursForm(form).tue).toMatch(/after opening/);
  });

  it("rejects overlapping ranges on one day", () => {
    const form = formWith((value) => {
      value.days.wed = {
        open: true,
        ranges: [
          { start: "09:00", end: "13:00" },
          { start: "12:00", end: "15:00" },
        ],
      };
    });

    expect(validateHoursForm(form).wed).toMatch(/overlap/);
  });

  it("rejects malformed times and ignores closed days", () => {
    const form = formWith((value) => {
      value.days.thu = { open: true, ranges: [{ start: "9am", end: "17:00" }] };
      value.days.fri = { open: false, ranges: [{ start: "bad", end: "bad" }] };
    });

    const errors = validateHoursForm(form);
    expect(errors.thu).toMatch(/24-hour/);
    expect(errors.fri).toBeUndefined();
  });

  it("has no errors when hours are switched off", () => {
    const form = toHoursForm(null);
    form.days.mon = { open: true, ranges: [{ start: "x", end: "y" }] };

    expect(validateHoursForm(form)).toEqual({});
  });
});
