import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

const VALID = {
  DATABASE_URL: "postgresql://queuecare:queuecare@db:5432/queuecare_dev",
  BETTER_AUTH_SECRET: "test-secret-0123456789abcdef0123456789",
  BETTER_AUTH_URL: "http://localhost:3000",
};

describe("parseEnv", () => {
  it("accepts valid settings and defaults NODE_ENV", () => {
    const env = parseEnv(VALID);

    expect(env.DATABASE_URL).toBe(VALID.DATABASE_URL);
    expect(env.NODE_ENV).toBe("development");
  });

  it("rejects a missing DATABASE_URL", () => {
    expect(() => parseEnv({ ...VALID, DATABASE_URL: undefined })).toThrow(
      /DATABASE_URL/,
    );
  });

  it("rejects a non-PostgreSQL URL", () => {
    expect(() =>
      parseEnv({ ...VALID, DATABASE_URL: "mysql://db:3306/app" }),
    ).toThrow(/DATABASE_URL/);
  });

  it("rejects a short auth secret", () => {
    expect(() =>
      parseEnv({ ...VALID, BETTER_AUTH_SECRET: "too-short" }),
    ).toThrow(/BETTER_AUTH_SECRET/);
  });

  it("leaves email unconfigured when no Resend key is set", () => {
    const env = parseEnv(VALID);

    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.EMAIL_FROM).toBeUndefined();
  });

  it("requires EMAIL_FROM when a Resend key is set", () => {
    expect(() => parseEnv({ ...VALID, RESEND_API_KEY: "re_123" })).toThrow(
      /EMAIL_FROM/,
    );
    expect(
      parseEnv({
        ...VALID,
        RESEND_API_KEY: "re_123",
        EMAIL_FROM: "QueueCare <notifications@example.com>",
      }).EMAIL_FROM,
    ).toBe("QueueCare <notifications@example.com>");
  });

  it("accepts a bare sender address and rejects a malformed one", () => {
    expect(
      parseEnv({ ...VALID, EMAIL_FROM: "notifications@example.com" })
        .EMAIL_FROM,
    ).toBe("notifications@example.com");
    expect(() =>
      parseEnv({ ...VALID, EMAIL_FROM: "QueueCare notifications" }),
    ).toThrow(/EMAIL_FROM/);
  });

  it("rejects a short internal job secret", () => {
    expect(() =>
      parseEnv({ ...VALID, INTERNAL_JOB_SECRET: "too-short" }),
    ).toThrow(/INTERNAL_JOB_SECRET/);
  });

  it("rejects a missing or non-HTTP auth URL", () => {
    expect(() => parseEnv({ ...VALID, BETTER_AUTH_URL: undefined })).toThrow(
      /BETTER_AUTH_URL/,
    );
    expect(() =>
      parseEnv({ ...VALID, BETTER_AUTH_URL: "ftp://example.com" }),
    ).toThrow(/BETTER_AUTH_URL/);
  });
});
