import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

const DATABASE_URL = "postgresql://queuecare:queuecare@db:5432/queuecare_dev";

describe("parseEnv", () => {
  it("accepts a PostgreSQL URL and defaults NODE_ENV", () => {
    const env = parseEnv({ DATABASE_URL });

    expect(env.DATABASE_URL).toBe(DATABASE_URL);
    expect(env.NODE_ENV).toBe("development");
  });

  it("rejects a missing DATABASE_URL", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it("rejects a non-PostgreSQL URL", () => {
    expect(() => parseEnv({ DATABASE_URL: "mysql://db:3306/app" })).toThrow(
      /DATABASE_URL/,
    );
  });
});
