import type { StaffTokenResponse } from "@/features/queue/contracts";
import { queueNotFound } from "@/features/queue/errors";
import { parseUuid } from "@/features/queue/http";
import { findQueueClinicId, getStaffTokenView } from "@/features/queue/queries";
import { callNext } from "@/features/queue/service";
import { requireClinicPermission } from "@/lib/auth/guards";
import { withApiHandler } from "@/lib/errors/api-handler";

export const POST = withApiHandler(
  async (
    _request,
    context: RouteContext<"/api/queues/[queueId]/call-next">,
  ) => {
    const queueId = parseUuid((await context.params).queueId, queueNotFound);
    const clinicId = await findQueueClinicId(queueId);
    if (!clinicId) {
      throw queueNotFound();
    }
    const access = await requireClinicPermission(clinicId, "queue.callNext");

    const tokenId = await callNext(queueId, access);
    const token = await getStaffTokenView(tokenId);
    return Response.json({ token } satisfies StaffTokenResponse);
  },
);
