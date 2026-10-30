import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  demoLoginsEnabled,
} from "@/lib/auth/demo-accounts";
import { parseEnv } from "@/lib/env";

const VALID = {
  DATABASE_URL: "postgresql://queuecare:queuecare@db:5432/queuecare_dev",
  BETTER_AUTH_SECRET: "test-secret-0123456789abcdef0123456789",
  BETTER_AUTH_URL: "http://localhost:3000",
};

describe("demoLoginsEnabled", () => {
  it("offers the demo accounts in development and tests", () => {
    expect(demoLoginsEnabled(parseEnv(VALID))).toBe(true);
    expect(demoLoginsEnabled(parseEnv({ ...VALID, NODE_ENV: "test" }))).toBe(
      true,
    );
  });

  it("hides them in production unless DEMO_LOGINS is on", () => {
    const production = { ...VALID, NODE_ENV: "production" };

    expect(demoLoginsEnabled(parseEnv(production))).toBe(false);
    expect(
      demoLoginsEnabled(parseEnv({ ...production, DEMO_LOGINS: "false" })),
    ).toBe(false);
    expect(
      demoLoginsEnabled(parseEnv({ ...production, DEMO_LOGINS: "true" })),
    ).toBe(true);
  });

  it("rejects a DEMO_LOGINS value that is not a yes or no", () => {
    expect(() => parseEnv({ ...VALID, DEMO_LOGINS: "sometimes" })).toThrow(
      /DEMO_LOGINS/,
    );
  });
});

describe("DEMO_ACCOUNTS", () => {
  const seed = readFileSync(join(process.cwd(), "prisma/seed.sql"), "utf8");

  it("lists one account per panel, each created by the seed", () => {
    expect(DEMO_ACCOUNTS.map((account) => account.role)).toEqual([
      "Reception",
      "Doctor",
      "Clinic admin",
      "Super admin",
    ]);
    for (const account of DEMO_ACCOUNTS) {
      expect(seed).toContain(`'${account.email}'`);
    }
  });

  it("uses the seed's password", () => {
    expect(seed).toContain(`"${DEMO_PASSWORD}"`);
  });
});
