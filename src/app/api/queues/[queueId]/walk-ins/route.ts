import {
  walkInBodySchema,
  type StaffTokenResponse,
} from "@/features/queue/contracts";
import { queueNotFound } from "@/features/queue/errors";
import {
  parseUuid,
  readIdempotencyKey,
  readJsonBody,
} from "@/features/queue/http";
import { findQueueClinicId, getStaffTokenView } from "@/features/queue/queries";
import { createWalkIn } from "@/features/queue/service";
import { requireClinicPermission } from "@/lib/auth/guards";
import { withApiHandler } from "@/lib/errors/api-handler";

// Reception registers a walk-in. 201 for a new token, 200 for a replayed retry.
export const POST = withApiHandler(
  async (request, context: RouteContext<"/api/queues/[queueId]/walk-ins">) => {
    const queueId = parseUuid((await context.params).queueId, queueNotFound);
    const clinicId = await findQueueClinicId(queueId);
    if (!clinicId) {
      throw queueNotFound();
    }
    const access = await requireClinicPermission(clinicId, "walkIn.create");
    const idempotencyKey = readIdempotencyKey(request);
    const body = walkInBodySchema.parse(await readJsonBody(request));

    const result = await createWalkIn(
      { queueId, patientName: body.patientName, idempotencyKey },
      access,
    );
    const token = await getStaffTokenView(result.tokenId);
    return Response.json({ token } satisfies StaffTokenResponse, {
      status: result.created ? 201 : 200,
    });
  },
);
