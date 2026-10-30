import { AppError } from "@/lib/errors/app-error";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  // Epoch milliseconds when the current window ends.
  resetAt: number;
};

export type RateLimiter = {
  check(key: string): RateLimitResult;
};

// Sweep expired windows once the map grows past this, so memory stays bounded.
const SWEEP_THRESHOLD = 10_000;

// Fixed-window limiter kept in this process's memory.
//
// Only correct with a single app instance: each instance counts on its own
// and counts reset on restart. Move to the database (or Redis, once it is
// justified) before running more than one instance.
export function createRateLimiter(options: {
  limit: number;
  windowMs: number;
  now?: () => number;
}): RateLimiter {
  const { limit, windowMs, now = Date.now } = options;
  const windows = new Map<string, { count: number; resetAt: number }>();

  return {
    check(key) {
      const time = now();
      if (windows.size > SWEEP_THRESHOLD) {
        for (const [storedKey, window] of windows) {
          if (time >= window.resetAt) {
            windows.delete(storedKey);
          }
        }
      }

      let window = windows.get(key);
      if (!window || time >= window.resetAt) {
        window = { count: 0, resetAt: time + windowMs };
        windows.set(key, window);
      }
      window.count += 1;

      return {
        allowed: window.count <= limit,
        remaining: Math.max(0, limit - window.count),
        resetAt: window.resetAt,
      };
    },
  };
}

export function enforceRateLimit(limiter: RateLimiter, key: string): void {
  if (!limiter.check(key).allowed) {
    throw new AppError(
      "RATE_LIMITED",
      "Too many requests. Please wait a moment and try again.",
    );
  }
}
