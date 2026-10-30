import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors/app-error";
import { createRateLimiter, enforceRateLimit } from "@/lib/rate-limit";

function limiterAt(clock: { now: number }, limit = 2) {
  return createRateLimiter({ limit, windowMs: 1_000, now: () => clock.now });
}

describe("createRateLimiter", () => {
  it("allows up to the limit, then blocks", () => {
    const clock = { now: 0 };
    const limiter = limiterAt(clock);

    expect(limiter.check("ip-1")).toMatchObject({
      allowed: true,
      remaining: 1,
    });
    expect(limiter.check("ip-1")).toMatchObject({
      allowed: true,
      remaining: 0,
    });
    expect(limiter.check("ip-1")).toMatchObject({
      allowed: false,
      remaining: 0,
    });
  });

  it("starts a new window after it expires", () => {
    const clock = { now: 0 };
    const limiter = limiterAt(clock, 1);

    limiter.check("ip-1");
    expect(limiter.check("ip-1").allowed).toBe(false);

    clock.now = 1_000;
    expect(limiter.check("ip-1")).toMatchObject({
      allowed: true,
      resetAt: 2_000,
    });
  });

  it("counts each key separately", () => {
    const clock = { now: 0 };
    const limiter = limiterAt(clock, 1);

    limiter.check("ip-1");
    expect(limiter.check("ip-2").allowed).toBe(true);
  });
});

describe("enforceRateLimit", () => {
  it("throws RATE_LIMITED once the limit is used up", () => {
    const limiter = limiterAt({ now: 0 }, 1);

    expect(() => enforceRateLimit(limiter, "ip-1")).not.toThrow();
    const error = (() => {
      try {
        enforceRateLimit(limiter, "ip-1");
      } catch (caught) {
        return caught;
      }
    })();
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("RATE_LIMITED");
  });
});
