import { after, connection } from "next/server";
import { requireStaffMember } from "@/features/messaging/access";
import {
  createBroadcast,
  findBroadcastReplay,
  listBroadcasts,
  processPendingBroadcasts,
} from "@/features/messaging/broadcasts";
import {
  createBroadcastBodySchema,
  type BroadcastSummary,
} from "@/features/messaging/contracts";
import { readMessagingBody } from "@/features/messaging/http";
import { announcementLimiter } from "@/features/messaging/limits";
import { withApiHandler } from "@/lib/errors/api-handler";
import { logError } from "@/lib/log";
import { enforceRateLimit } from "@/lib/rate-limit";

// GET → BroadcastSummary[] (newest first, 50).
export const GET = withApiHandler(async () => {
  await connection();
  const member = await requireStaffMember("announcements.send");
  return Response.json(
    (await listBroadcasts(member)) satisfies BroadcastSummary[],
  );
});

// POST CreateBroadcastBody → BroadcastSummary: 201 when created, 200 when a
// retry with the same idempotency key returns the existing announcement.
// Retries are answered before the rate limit counts, so a retry after a
// lost response never gets 429. Delivery starts right after the response;
// the outbox worker finishes it if this process stops first.
export const POST = withApiHandler(async (request, _context, requestId) => {
  const member = await requireStaffMember("announcements.send");
  const body = await readMessagingBody(request, createBroadcastBodySchema);

  const replay = await findBroadcastReplay(member, body);
  if (!replay) enforceRateLimit(announcementLimiter, member.clinicId);
  const { summary, created } = replay
    ? { summary: replay, created: false }
    : await createBroadcast(member, body);
  after(async () => {
    try {
      await processPendingBroadcasts({ broadcastId: summary.id });
    } catch (error) {
      logError("Announcement delivery failed", { requestId, error });
    }
  });
  return Response.json(summary satisfies BroadcastSummary, {
    status: created ? 201 : 200,
  });
});
