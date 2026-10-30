import { z } from "zod";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors/app-error";
import { idempotencyKeySchema } from "@/lib/idempotency";
import { IDEMPOTENCY_KEY_HEADER } from "./contracts";

// Small helpers shared by the queue route handlers.

const uuidSchema = z.uuid();

// Malformed IDs get the same 404 as unknown ones instead of a database error.
export function parseUuid(value: string, notFound: () => AppError): string {
  if (!uuidSchema.safeParse(value).success) {
    throw notFound();
  }
  return value;
}

export function readIdempotencyKey(request: Request): string {
  const parsed = idempotencyKeySchema.safeParse(
    request.headers.get(IDEMPOTENCY_KEY_HEADER),
  );
  if (!parsed.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Send a unique Idempotency-Key header with this request.",
    );
  }
  return parsed.data;
}

// An empty body counts as {}, so requests whose fields are all optional can omit it.
export async function readJsonBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text.trim()) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("VALIDATION_ERROR", "The request body must be JSON.");
  }
}

// Client address for rate-limit keys only, never identity. Read only from the
// header named in TRUSTED_IP_HEADER, which the reverse proxy overwrites; any
// other header can be forged, so without a proxy every caller shares one key.
export function clientIp(
  request: Request,
  header: string | null = getEnv().TRUSTED_IP_HEADER ?? null,
): string {
  if (!header) {
    return "unknown";
  }
  // The proxy appends the address it saw, so the last entry is the one it vouches for.
  return request.headers.get(header)?.split(",").at(-1)?.trim() || "unknown";
}
