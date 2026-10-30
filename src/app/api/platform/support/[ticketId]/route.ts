import { supportTicketUpdateSchema } from "@/features/platform/schemas";
import { updateTicketStatus } from "@/features/platform/support";
import { readJsonBody } from "@/features/queue/http";
import { withApiHandler } from "@/lib/errors/api-handler";

// PATCH { status } — move a ticket through OPEN → IN_PROGRESS → RESOLVED.
export const PATCH = withApiHandler(
  async (
    request,
    context: RouteContext<"/api/platform/support/[ticketId]">,
  ) => {
    const { ticketId } = await context.params;
    const { status } = supportTicketUpdateSchema.parse(
      await readJsonBody(request),
    );
    const ticket = await updateTicketStatus(ticketId, status);
    return Response.json({ ticket });
  },
);
