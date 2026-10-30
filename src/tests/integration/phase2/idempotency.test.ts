import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import {
  findIdempotentResult,
  fingerprintRequest,
  saveIdempotentResult,
} from "@/lib/idempotency";

// Needs the test database with migrations applied (npm run db:deploy).
const scope = `test:${crypto.randomUUID()}`;
const key = crypto.randomUUID();
const fingerprint = fingerprintRequest({ serviceId: "s1", name: "Priya" });

afterAll(async () => {
  await getDb().idempotencyRecord.deleteMany({ where: { scope } });
});

describe("idempotency records", () => {
  it("replays the original result for the same key and request", async () => {
    const db = getDb();
    await db.$transaction(async (tx) => {
      expect(
        await findIdempotentResult(tx, { scope, key, fingerprint }),
      ).toBeNull();
      await saveIdempotentResult(tx, {
        scope,
        key,
        fingerprint,
        responseReference: "token-1",
      });
    });

    const replay = await db.$transaction((tx) =>
      findIdempotentResult(tx, { scope, key, fingerprint }),
    );
    expect(replay).toBe("token-1");
  });

  it("rejects the same key with a different request", async () => {
    const error = await getDb()
      .$transaction((tx) =>
        findIdempotentResult(tx, {
          scope,
          key,
          fingerprint: fingerprintRequest({ serviceId: "s2" }),
        }),
      )
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("lets the unique constraint stop a racing duplicate", async () => {
    const save = () =>
      getDb().$transaction((tx) =>
        saveIdempotentResult(tx, {
          scope,
          key: `${key}-race`,
          fingerprint,
          responseReference: "token-2",
        }),
      );
    const results = await Promise.allSettled([save(), save()]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
  });
});
