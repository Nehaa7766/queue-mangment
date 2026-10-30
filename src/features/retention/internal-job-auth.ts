import { createHash, timingSafeEqual } from "node:crypto";

export type InternalJobAuth = "ok" | "unconfigured" | "denied";

// Checks `Authorization: Bearer <INTERNAL_JOB_SECRET>` for /api/internal/*
// jobs and monitoring details. Both sides are hashed first so the comparison
// takes the same time whatever the length or content of the guess.
export function checkInternalJobAuth(
  request: Request,
  secret: string | undefined,
): InternalJobAuth {
  if (!secret) {
    return "unconfigured";
  }
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) {
    return "denied";
  }
  return timingSafeEqual(sha256(match[1]), sha256(secret)) ? "ok" : "denied";
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}
