import { describe, expect, it } from "vitest";
import {
  backoffDelayMs,
  MAX_ATTEMPTS,
  sanitizeError,
  stripOneTimeLink,
} from "@/features/notifications/outbox-worker";

const MINUTE = 60_000;

describe("backoffDelayMs", () => {
  it("doubles from one minute and stops at one hour", () => {
    const schedule = Array.from({ length: MAX_ATTEMPTS }, (_, index) =>
      backoffDelayMs(index + 1),
    );

    expect(schedule).toEqual([
      1 * MINUTE,
      2 * MINUTE,
      4 * MINUTE,
      8 * MINUTE,
      16 * MINUTE,
      32 * MINUTE,
      60 * MINUTE,
      60 * MINUTE,
    ]);
  });

  it("never waits less than a minute", () => {
    expect(backoffDelayMs(0)).toBe(MINUTE);
  });
});

describe("sanitizeError", () => {
  it("removes links and email addresses", () => {
    const message = sanitizeError(
      new Error(
        "Bounce for priya@clinic.test, link https://app.test/reset-password?token=abc123",
      ),
    );

    expect(message).toBe("Bounce for [email] link [link]");
  });

  it("keeps the stored message short", () => {
    expect(sanitizeError("x".repeat(1000))).toHaveLength(300);
  });
});

describe("stripOneTimeLink", () => {
  it("drops the link and keeps the rest of the payload", () => {
    expect(
      stripOneTimeLink("auth.password-reset-requested", {
        userId: "u1",
        email: "a@b.test",
        resetUrl: "https://app.test/reset-password?token=secret",
      }),
    ).toEqual({ userId: "u1", email: "a@b.test" });

    expect(
      stripOneTimeLink("staff.invited", {
        invitationId: "i1",
        acceptUrl: "https://app.test/accept-invite?token=secret",
      }),
    ).toEqual({ invitationId: "i1" });
  });
});
