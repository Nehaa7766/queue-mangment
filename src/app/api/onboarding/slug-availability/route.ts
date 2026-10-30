import { checkSlugAvailability } from "@/features/onboarding/signup";
import type { SlugAvailabilityResponse } from "@/features/onboarding/signup-schema";
import { clientIp } from "@/features/queue/http";
import { withApiHandler } from "@/lib/errors/api-handler";
import { createRateLimiter, enforceRateLimit } from "@/lib/rate-limit";

// The form checks as people type, so allow a generous rate.
const slugLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

// GET ?slug=sharma-clinic → whether that public address is free.
export const GET = withApiHandler(async (request) => {
  enforceRateLimit(slugLimiter, `slug:${clientIp(request)}`);
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  const result = await checkSlugAvailability(slug);
  return Response.json({
    slug,
    available: result.available,
    reason: result.available ? undefined : result.reason,
  } satisfies SlugAvailabilityResponse);
});
