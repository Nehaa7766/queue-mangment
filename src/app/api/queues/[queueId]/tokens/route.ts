import {
  joinQueueBodySchema,
  type PublicTokenResponse,
  type StaffQueueView,
} from "@/features/queue/contracts";
import { queueNotFound, tokenNotFound } from "@/features/queue/errors";
import {
  clientIp,
  parseUuid,
  readIdempotencyKey,
  readJsonBody,
} from "@/features/queue/http";
import {
  getPublicTokenView,
  getStaffQueueView,
} from "@/features/queue/queries";
import { joinQueue } from "@/features/queue/service";
import { withApiHandler } from "@/lib/errors/api-handler";
import { createRateLimiter, enforceRateLimit } from "@/lib/rate-limit";

// Per client IP and queue. Generous because patients on clinic Wi-Fi share one IP.
const joinLimiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

type Context = RouteContext<"/api/queues/[queueId]/tokens">;

// Staff: the live queue (requires queue.view on the queue's clinic).
export const GET = withApiHandler(async (_request, context: Context) => {
  const queueId = parseUuid((await context.params).queueId, queueNotFound);
  const view = await getStaffQueueView(queueId);
  if (!view) {
    throw queueNotFound();
  }
  return Response.json(view satisfies StaffQueueView);
});

// Public: a patient joins after explicitly confirming. 201 for a new token,
// 200 when a retry with the same idempotency key replays the original.
export const POST = withApiHandler(async (request, context: Context) => {
  const queueId = parseUuid((await context.params).queueId, queueNotFound);
  enforceRateLimit(joinLimiter, `${clientIp(request)}:${queueId}`);
  const idempotencyKey = readIdempotencyKey(request);
  const body = joinQueueBodySchema.parse(await readJsonBody(request));

  const result = await joinQueue({
    queueId,
    patientName: body.patientName,
    idempotencyKey,
  });
  const token = await getPublicTokenView(result.publicTokenId);
  if (!token) {
    throw tokenNotFound();
  }
  return Response.json({ token } satisfies PublicTokenResponse, {
    status: result.created ? 201 : 200,
  });
});
