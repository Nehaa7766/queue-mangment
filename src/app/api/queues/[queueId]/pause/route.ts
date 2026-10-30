import { handleQueueStatusChange } from "@/features/queue/queue-status-route";
import { withApiHandler } from "@/lib/errors/api-handler";

export const POST = withApiHandler(
  async (_request, context: RouteContext<"/api/queues/[queueId]/pause">) =>
    handleQueueStatusChange((await context.params).queueId, "pause"),
);
