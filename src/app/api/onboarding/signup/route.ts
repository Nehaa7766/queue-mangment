import { signUpClinic } from "@/features/onboarding/signup";
import {
  signupSchema,
  type SignupResponse,
} from "@/features/onboarding/signup-schema";
import { clientIp, readJsonBody } from "@/features/queue/http";
import { withApiHandler } from "@/lib/errors/api-handler";
import { createRateLimiter, enforceRateLimit } from "@/lib/rate-limit";

// A real clinic signs up once; a few tries an hour per address is plenty and
// slows down scripted signups.
const signupLimiter = createRateLimiter({ limit: 5, windowMs: 60 * 60_000 });

export const POST = withApiHandler(async (request) => {
  enforceRateLimit(signupLimiter, `signup:${clientIp(request)}`);
  const input = signupSchema.parse(await readJsonBody(request));
  const result = await signUpClinic(input);
  return Response.json(
    {
      clinicSlug: result.clinicSlug,
      status: "PENDING_APPROVAL",
    } satisfies SignupResponse,
    { status: 201 },
  );
});
