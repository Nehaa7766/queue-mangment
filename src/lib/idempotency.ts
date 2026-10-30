import { createHash } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors/app-error";

// Client-generated keys, e.g. crypto.randomUUID().
export const idempotencyKeySchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[\w-]+$/);

export type IdempotencyInput = {
  // Narrows where a key is unique, e.g. `queue:${queueId}:join`.
  scope: string;
  key: string;
  // sha256 from fingerprintRequest().
  fingerprint: string;
};

// JSON with object keys sorted at every level, so the same body always
// produces the same string regardless of key order.
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

export function fingerprintRequest(body: unknown): string {
  return createHash("sha256").update(canonicalJson(body)).digest("hex");
}

// Call inside the action's transaction, before doing the work. Returns the
// original result's reference for a safe retry, or null for a new request.
export async function findIdempotentResult(
  tx: Prisma.TransactionClient,
  input: IdempotencyInput,
): Promise<string | null> {
  const existing = await tx.idempotencyRecord.findUnique({
    where: {
      scope_idempotencyKey: { scope: input.scope, idempotencyKey: input.key },
    },
    select: { requestFingerprint: true, responseReference: true },
  });
  if (!existing) {
    return null;
  }
  if (existing.requestFingerprint !== input.fingerprint) {
    throw new AppError(
      "IDEMPOTENCY_CONFLICT",
      "This request was already sent with different details.",
    );
  }
  return existing.responseReference;
}

// Call in the same transaction as the work. If two requests with one key
// race, the unique (scope, key) constraint fails the second transaction;
// retrying it then finds the first result instead of acting twice.
export async function saveIdempotentResult(
  tx: Prisma.TransactionClient,
  input: IdempotencyInput & { responseReference: string },
): Promise<void> {
  await tx.idempotencyRecord.create({
    data: {
      scope: input.scope,
      idempotencyKey: input.key,
      requestFingerprint: input.fingerprint,
      responseReference: input.responseReference,
    },
  });
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, sortKeys(record[key])]),
    );
  }
  return value;
}
