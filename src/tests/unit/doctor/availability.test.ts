import { describe, expect, it } from "vitest";
import {
  availabilityBodySchema,
  doctorsNeedingNotice,
  minutesLeft,
  noDoctorOnDuty,
  patientDoctorNotice,
} from "@/features/doctor/availability";
import { NOW, queueDoctor } from "./fixtures";

const minutesAgo = (minutes: number) =>
  new Date(NOW - minutes * 60_000).toISOString();

describe("availabilityBodySchema", () => {
  it("accepts a break with a delay and trims the note", () => {
    expect(
      availabilityBodySchema.parse({
        availability: "ON_BREAK",
        delayMinutes: 15,
        note: "  Back after lunch  ",
      }),
    ).toEqual({
      availability: "ON_BREAK",
      delayMinutes: 15,
      note: "Back after lunch",
    });
  });

  it("defaults the delay to 0 and turns an empty note into null", () => {
    expect(
      availabilityBodySchema.parse({ availability: "AVAILABLE", note: "  " }),
    ).toEqual({ availability: "AVAILABLE", delayMinutes: 0, note: null });
  });

  it("clears the delay when off duty", () => {
    expect(
      availabilityBodySchema.parse({
        availability: "OFF_DUTY",
        delayMinutes: 30,
      }).delayMinutes,
    ).toBe(0);
  });

  it.each([
    { availability: "LUNCH" },
    { availability: "AVAILABLE", delayMinutes: -1 },
    { availability: "AVAILABLE", delayMinutes: 241 },
    { availability: "AVAILABLE", delayMinutes: 2.5 },
    { availability: "AVAILABLE", note: "x".repeat(121) },
  ])("rejects %o", (body) => {
    expect(availabilityBodySchema.safeParse(body).success).toBe(false);
  });
});

describe("minutesLeft", () => {
  it("counts down from when the break was set", () => {
    expect(
      minutesLeft({ delayMinutes: 15, updatedAt: minutesAgo(5) }, NOW),
    ).toBe(10);
  });

  it("never goes below zero", () => {
    expect(
      minutesLeft({ delayMinutes: 15, updatedAt: minutesAgo(40) }, NOW),
    ).toBe(0);
  });

  it("is zero without an announced delay", () => {
    expect(minutesLeft({ delayMinutes: 0, updatedAt: null }, NOW)).toBe(0);
  });
});

describe("patientDoctorNotice", () => {
  it("says nothing without doctors or when everyone is off duty", () => {
    expect(patientDoctorNotice([], NOW)).toBeNull();
    expect(
      patientDoctorNotice([queueDoctor({ availability: "OFF_DUTY" })], NOW),
    ).toBeNull();
  });

  it("says nothing while an available doctor is on time", () => {
    expect(
      patientDoctorNotice(
        [queueDoctor(), queueDoctor({ availability: "ON_BREAK" })],
        NOW,
      ),
    ).toBeNull();
  });

  it("reports a break when nobody on duty is available", () => {
    expect(
      patientDoctorNotice(
        [
          queueDoctor({ availability: "ON_BREAK", delayMinutes: 0 }),
          queueDoctor({ availability: "OFF_DUTY" }),
        ],
        NOW,
      ),
    ).toEqual({ kind: "ON_BREAK", delayMinutes: 0 });
  });

  it("uses the soonest expected return for a break", () => {
    expect(
      patientDoctorNotice(
        [
          queueDoctor({
            availability: "ON_BREAK",
            delayMinutes: 30,
            updatedAt: minutesAgo(5),
          }),
          queueDoctor({
            availability: "ON_BREAK",
            delayMinutes: 15,
            updatedAt: minutesAgo(5),
          }),
        ],
        NOW,
      ),
    ).toEqual({ kind: "ON_BREAK", delayMinutes: 10 });
  });

  it("reports the smallest delay when every available doctor is late", () => {
    expect(
      patientDoctorNotice(
        [
          queueDoctor({ delayMinutes: 20 }),
          queueDoctor({ delayMinutes: 10 }),
          queueDoctor({ availability: "ON_BREAK" }),
        ],
        NOW,
      ),
    ).toEqual({ kind: "DELAYED", delayMinutes: 10 });
  });
});

describe("reception notices", () => {
  it("lists doctors on a break or running late", () => {
    const late = queueDoctor({ name: "Late", delayMinutes: 10 });
    const away = queueDoctor({ name: "Away", availability: "ON_BREAK" });
    expect(
      doctorsNeedingNotice([
        queueDoctor({ name: "On time" }),
        late,
        away,
        queueDoctor({ name: "Off", availability: "OFF_DUTY" }),
      ]),
    ).toEqual([late, away]);
  });

  it("flags a service whose doctors are all off duty", () => {
    expect(noDoctorOnDuty([])).toBe(false);
    expect(
      noDoctorOnDuty([
        queueDoctor({ availability: "OFF_DUTY" }),
        queueDoctor({ availability: "OFF_DUTY" }),
      ]),
    ).toBe(true);
    expect(
      noDoctorOnDuty([
        queueDoctor({ availability: "OFF_DUTY" }),
        queueDoctor({ availability: "ON_BREAK" }),
      ]),
    ).toBe(false);
  });
});
