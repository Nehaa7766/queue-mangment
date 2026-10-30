import { handleQueueStatusChange } from "@/features/queue/queue-status-route";
import { withApiHandler } from "@/lib/errors/api-handler";

// Ends the queue for the day; a closed queue can't be reopened.
export const POST = withApiHandler(
  async (_request, context: RouteContext<"/api/queues/[queueId]/close">) =>
    handleQueueStatusChange((await context.params).queueId, "close"),
);
