import { processPendingBroadcasts } from "@/features/messaging/broadcasts";
import { processOutboxBatch } from "@/features/notifications/outbox-worker";
import { checkInternalJobAuth } from "@/features/retention/internal-job-auth";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors/app-error";
import { withApiHandler, type ErrorBody } from "@/lib/errors/api-handler";

// POST /api/internal/outbox/process — called every few seconds by the worker
// container (docker-compose `worker`), never by a browser.
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

  const outbox = await processOutboxBatch();
  // Announcements left over from a crashed or busy process
  // (docs/MESSAGING.md, "Announcements").
  const announcements = await processPendingBroadcasts();
  return Response.json({ ...outbox, announcements });
});
