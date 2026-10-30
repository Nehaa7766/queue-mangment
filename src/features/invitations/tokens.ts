import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

// Invitation links carry 32 random bytes; only a SHA-256 hash is stored, so a
// database leak doesn't hand out working links.

export const INVITATION_TTL_DAYS = 7;

// 32 bytes in base64url is 43 characters.
export const invitationTokenSchema = z.string().regex(/^[\w-]{43}$/);

export function newInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function invitationExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}
