import { describe, expect, it } from "vitest";
import {
  SIGNUP_STEPS,
  isValidTimeZone,
  signupSchema,
  type SignupInput,
} from "@/features/onboarding/signup-schema";

const VALID = {
  clinicName: "Sharma Clinic",
  clinicSlug: "sharma-clinic",
  timezone: "Asia/Kolkata",
  serviceName: "General",
  tokenPrefix: "a",
  serviceMinutes: 10,
  adminName: "Asha Sharma",
  adminEmail: "  Asha@Example.COM ",
  password: "long-enough",
};

function firstError(input: Record<string, unknown>, field: keyof SignupInput) {
  const result = signupSchema.safeParse(input);
  return result.error?.issues.find((issue) => issue.path[0] === field)?.message;
}

describe("signupSchema", () => {
  it("normalizes the email and token letter", () => {
    const parsed = signupSchema.parse(VALID);
    expect(parsed.adminEmail).toBe("asha@example.com");
    expect(parsed.tokenPrefix).toBe("A");
  });

  it("rejects a bad email, short password and unknown time zone", () => {
    expect(firstError({ ...VALID, adminEmail: "asha" }, "adminEmail")).toBe(
      "Enter a valid email address.",
    );
    expect(firstError({ ...VALID, password: "short" }, "password")).toBe(
      "Use at least 8 characters.",
    );
    expect(firstError({ ...VALID, timezone: "Mars/Olympus" }, "timezone")).toBe(
      "Choose a valid time zone.",
    );
  });

  it("rejects a token prefix that isn't 1 to 3 letters", () => {
    expect(firstError({ ...VALID, tokenPrefix: "A1" }, "tokenPrefix")).toBe(
      "Use 1 to 3 letters, e.g. A.",
    );
    expect(firstError({ ...VALID, tokenPrefix: "ABCD" }, "tokenPrefix")).toBe(
      "Use 1 to 3 letters, e.g. A.",
    );
  });

  it("rejects minutes that aren't a whole number in range", () => {
    expect(
      firstError({ ...VALID, serviceMinutes: Number.NaN }, "serviceMinutes"),
    ).toBeTruthy();
    expect(firstError({ ...VALID, serviceMinutes: 0 }, "serviceMinutes")).toBe(
      "Use at least 1 minute.",
    );
    expect(
      firstError({ ...VALID, serviceMinutes: 2.5 }, "serviceMinutes"),
    ).toBe("Use whole minutes.");
  });

  it("splits every field into exactly one wizard step", () => {
    const fields = SIGNUP_STEPS.flatMap((step) => step.fields).sort();
    expect(fields).toEqual(Object.keys(signupSchema.shape).sort());
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA names and rejects anything else", () => {
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("India")).toBe(false);
  });
});
