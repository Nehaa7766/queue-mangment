import { checkInternalJobAuth } from "@/features/retention/internal-job-auth";
import { runRetention } from "@/features/retention/retention";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors/app-error";
import { withApiHandler, type ErrorBody } from "@/lib/errors/api-handler";

// POST /api/internal/retention/run — called on a schedule (docs/RUNBOOK.md),
// never by a browser.
export const POST = withApiHandler(async (request, _context, requestId) => {
  const auth = checkInternalJobAuth(request, getEnv().INTERNAL_JOB_SECRET);
  if (auth === "unconfigured") {
    const body: ErrorBody = {
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal jobs are not configured on this server.",
        requestId,
      },
    };
    return Response.json(body, { status: 503 });
  }
  if (auth === "denied") {
    throw new AppError("UNAUTHENTICATED", "A valid job token is required.");
  }

  return Response.json(await runRetention());
});
