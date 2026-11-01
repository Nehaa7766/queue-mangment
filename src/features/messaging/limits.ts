import { createRateLimiter } from "@/lib/rate-limit";

// docs/MESSAGING.md, "Limits and security". In process memory, like every
// other limit (docs/SECURITY_REVIEW.md finding 4).

// Per token link, keyed by the token's id.
export const patientSendLimiter = createRateLimiter({
  limit: 10,
  windowMs: 60_000,
});

// Per staff user.
export const staffSendLimiter = createRateLimiter({
  limit: 30,
  windowMs: 60_000,
});

// Per clinic.
export const announcementLimiter = createRateLimiter({
  limit: 5,
  windowMs: 10 * 60_000,
});

// Open live streams per process.
export const MAX_STREAMS_PER_TOKEN = 3;
export const MAX_STREAMS_PER_STAFF = 5;
