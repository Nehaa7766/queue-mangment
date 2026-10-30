import { describe, expect, it } from "vitest";
import {
  holidayInputSchema,
  queueSettingsSchema,
  settingsUpdateSchema,
} from "@/features/clinics/schemas";
import {
  acceptInvitationSchema,
  invitationInputSchema,
} from "@/features/invitations/schemas";
import { serviceInputSchema } from "@/features/services/schemas";
import { memberUpdateSchema } from "@/features/staff/schemas";

const QUEUE = {
  waitTargetMinutes: 20,
  gracePeriodSeconds: 300,
  maxQueueSize: null,
  noShowAction: "SKIP",
  allowRequeue: true,
  patientDataRetentionDays: 30,
} as const;

describe("service input", () => {
  it("upper-cases and trims the token prefix", () => {
    const result = serviceInputSchema.parse({
      name: " Dental ",
      description: "",
      tokenPrefix: " den ",
      estimatedDurationMinutes: 15,
    });

    expect(result).toEqual({
      name: "Dental",
      description: null,
      tokenPrefix: "DEN",
      estimatedDurationMinutes: 15,
    });
  });

  it.each(["", "ABCD", "A1", "Ä"])("rejects the prefix %j", (tokenPrefix) => {
    expect(
      serviceInputSchema.safeParse({
        name: "Dental",
        description: null,
        tokenPrefix,
        estimatedDurationMinutes: 15,
      }).success,
    ).toBe(false);
  });

  it("rejects durations outside 1–240 minutes", () => {
    for (const minutes of [0, 241, 2.5]) {
      expect(
        serviceInputSchema.safeParse({
          name: "Dental",
          description: null,
          tokenPrefix: "D",
          estimatedDurationMinutes: minutes,
        }).success,
      ).toBe(false);
    }
  });
});

describe("queue settings", () => {
  it("accepts sensible values", () => {
    expect(queueSettingsSchema.parse(QUEUE)).toEqual(QUEUE);
  });

  it("refuses sending no-shows back when requeue is off", () => {
    const result = queueSettingsSchema.safeParse({
      ...QUEUE,
      noShowAction: "REQUEUE",
      allowRequeue: false,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["noShowAction"]);
  });

  it("keeps the grace period between 1 and 30 minutes", () => {
    expect(
      queueSettingsSchema.safeParse({ ...QUEUE, gracePeriodSeconds: 30 })
        .success,
    ).toBe(false);
    expect(
      queueSettingsSchema.safeParse({ ...QUEUE, gracePeriodSeconds: 3600 })
        .success,
    ).toBe(false);
  });
});

describe("settings update", () => {
  it("routes each section to its own fields", () => {
    expect(
      settingsUpdateSchema.parse({ section: "queue", ...QUEUE }).section,
    ).toBe("queue");
    expect(
      settingsUpdateSchema.parse({ section: "hours", openingHours: null }),
    ).toEqual({ section: "hours", openingHours: null });
  });

  it("rejects an unknown time zone in the profile", () => {
    expect(
      settingsUpdateSchema.safeParse({
        section: "profile",
        name: "Demo Clinic",
        address: null,
        phone: null,
        timezone: "Mars/Olympus",
      }).success,
    ).toBe(false);
  });

  it("checks phone numbers loosely", () => {
    const profile = {
      section: "profile",
      name: "Demo Clinic",
      address: "",
      timezone: "Asia/Kolkata",
    };
    expect(
      settingsUpdateSchema.safeParse({ ...profile, phone: "+91 98765 43210" })
        .success,
    ).toBe(true);
    expect(
      settingsUpdateSchema.safeParse({ ...profile, phone: "call me" }).success,
    ).toBe(false);
  });
});

describe("holidays", () => {
  it("needs an ISO date and a name", () => {
    expect(
      holidayInputSchema.safeParse({ date: "2026-11-08", name: "Diwali" })
        .success,
    ).toBe(true);
    expect(
      holidayInputSchema.safeParse({ date: "08/11/2026", name: "Diwali" })
        .success,
    ).toBe(false);
    expect(
      holidayInputSchema.safeParse({ date: "2026-11-08", name: " " }).success,
    ).toBe(false);
  });
});

describe("invitations", () => {
  it("lower-cases the email", () => {
    expect(
      invitationInputSchema.parse({
        name: "Asha",
        email: "Asha@Example.TEST",
        role: "DOCTOR",
      }).email,
    ).toBe("asha@example.test");
  });

  it("rejects platform roles", () => {
    expect(
      invitationInputSchema.safeParse({
        name: "Asha",
        email: "asha@example.test",
        role: "SUPER_ADMIN",
      }).success,
    ).toBe(false);
  });

  it("needs a password of 8 to 128 characters when one is given", () => {
    expect(
      acceptInvitationSchema.safeParse({ name: "Asha", password: "short" })
        .success,
    ).toBe(false);
    expect(
      acceptInvitationSchema.safeParse({
        name: "Asha",
        password: "long-enough",
      }).success,
    ).toBe(true);
    expect(acceptInvitationSchema.safeParse({ name: "Asha" }).success).toBe(
      true,
    );
  });
});

describe("member update", () => {
  it("needs a role or a status", () => {
    expect(memberUpdateSchema.safeParse({}).success).toBe(false);
    expect(memberUpdateSchema.safeParse({ status: "INACTIVE" }).success).toBe(
      true,
    );
  });
});
