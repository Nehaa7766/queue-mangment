import type { TodayQueuesResponse } from "@/features/queue/contracts";
import { getTodayQueues } from "@/features/queue/queries";
import { withApiHandler } from "@/lib/errors/api-handler";

// Today's queues for one clinic (requires queue.view; checked inside).
export const GET = withApiHandler(
  async (
    _request,
    context: RouteContext<"/api/clinics/[clinicId]/queues/today">,
  ) => {
    const { clinicId } = await context.params;
    const queues = await getTodayQueues(clinicId);
    return Response.json({ queues } satisfies TodayQueuesResponse);
  },
);
