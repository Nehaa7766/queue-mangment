import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors/app-error";
import {
  canonicalJson,
  findIdempotentResult,
  fingerprintRequest,
  idempotencyKeySchema,
} from "@/lib/idempotency";

function fakeTx(record: unknown) {
  return {
    idempotencyRecord: { findUnique: vi.fn().mockResolvedValue(record) },
  } as unknown as Prisma.TransactionClient;
}

describe("canonicalJson", () => {
  it("ignores key order at every level", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } })).toBe(
      canonicalJson({ a: { c: [3, { e: 5, f: 4 }], d: 2 }, b: 1 }),
    );
  });

  it("drops undefined fields like JSON.stringify", () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
  });
});

describe("fingerprintRequest", () => {
  it("is a stable sha256 hex digest", () => {
    const fingerprint = fingerprintRequest({ serviceId: "s1", name: "Priya" });
    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(fingerprintRequest({ name: "Priya", serviceId: "s1" })).toBe(
      fingerprint,
    );
  });

  it("changes when the request changes", () => {
    expect(fingerprintRequest({ serviceId: "s1" })).not.toBe(
      fingerprintRequest({ serviceId: "s2" }),
    );
  });
});

describe("idempotencyKeySchema", () => {
  it("accepts UUIDs and rejects unsafe or tiny keys", () => {
    expect(idempotencyKeySchema.safeParse(crypto.randomUUID()).success).toBe(
      true,
    );
    expect(idempotencyKeySchema.safeParse("short").success).toBe(false);
    expect(idempotencyKeySchema.safeParse("has spaces in it").success).toBe(
      false,
    );
  });
});

describe("findIdempotentResult", () => {
  const input = {
    scope: "queue:q1:join",
    key: "key-12345",
    fingerprint: "a".repeat(64),
  };

  it("returns null for a new key", async () => {
    await expect(findIdempotentResult(fakeTx(null), input)).resolves.toBeNull();
  });

  it("returns the original reference for a retry", async () => {
    const tx = fakeTx({
      requestFingerprint: input.fingerprint,
      responseReference: "token-1",
    });
    await expect(findIdempotentResult(tx, input)).resolves.toBe("token-1");
  });

  it("rejects the same key with a different request", async () => {
    const tx = fakeTx({
      requestFingerprint: "b".repeat(64),
      responseReference: "token-1",
    });
    const error = await findIdempotentResult(tx, input).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("IDEMPOTENCY_CONFLICT");
  });
});
