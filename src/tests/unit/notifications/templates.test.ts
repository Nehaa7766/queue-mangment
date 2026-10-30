import { describe, expect, it } from "vitest";
import {
  describeTimeLeft,
  renderPasswordResetEmail,
  renderStaffInvitationEmail,
} from "@/features/notifications/templates";

const NOW = new Date("2026-10-30T10:00:00.000Z");

describe("renderStaffInvitationEmail", () => {
  const email = renderStaffInvitationEmail(
    {
      invitationId: "inv-1",
      email: "asha@clinic.test",
      name: "Asha <b>Rao</b>",
      clinicName: "Demo Clinic",
      role: "RECEPTIONIST",
      acceptUrl: "https://app.test/accept-invite?token=abc&x=1",
      expiresAt: "2026-11-06T10:00:00.000Z",
    },
    NOW,
  );

  it("names the clinic and role", () => {
    expect(email.subject).toBe("You're invited to Demo Clinic on QueueCare");
    expect(email.text).toContain("as a receptionist");
    expect(email.text).toContain("expires in about 7 days");
  });

  it("puts the link in both the HTML and the text version", () => {
    expect(email.text).toContain(
      "https://app.test/accept-invite?token=abc&x=1",
    );
    expect(email.html).toContain(
      'href="https://app.test/accept-invite?token=abc&amp;x=1"',
    );
  });

  it("escapes values in the HTML", () => {
    expect(email.html).toContain("Asha &lt;b&gt;Rao&lt;/b&gt;");
    expect(email.html).not.toContain("<b>Rao</b>");
  });

  it("is a full accessible document with charcoal text on the button", () => {
    expect(email.html).toMatch(/^<!doctype html>\n<html lang="en">/);
    expect(email.html).toContain("background:#CD8B62;color:#2A2D34");
    expect(email.html).not.toMatch(/#CD8B62;color:#(FFF|FFFFFF)\b/i);
  });
});

describe("renderPasswordResetEmail", () => {
  it("explains the link and how long it works", () => {
    const email = renderPasswordResetEmail(
      {
        userId: "u1",
        email: "asha@clinic.test",
        name: "Asha",
        resetUrl: "https://app.test/reset-password?token=t1",
        expiresAt: "2026-10-30T11:00:00.000Z",
      },
      NOW,
    );

    expect(email.subject).toBe("Reset your QueueCare password");
    expect(email.text).toContain("https://app.test/reset-password?token=t1");
    expect(email.text).toContain("expires in about 1 hour and works once");
    expect(email.text).toContain("If you didn't ask for this");
  });
});

describe("describeTimeLeft", () => {
  it.each([
    ["2026-10-30T10:00:20.000Z", "about 1 minute"],
    ["2026-10-30T10:20:00.000Z", "about 20 minutes"],
    ["2026-10-30T11:00:00.000Z", "about 1 hour"],
    ["2026-10-31T09:00:00.000Z", "about 23 hours"],
    ["2026-11-06T10:00:00.000Z", "about 7 days"],
  ])("%s → %s", (expiresAt, expected) => {
    expect(describeTimeLeft(expiresAt, NOW)).toBe(expected);
  });
});
