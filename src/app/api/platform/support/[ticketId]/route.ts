import {
  supportTicketEditSchema,
  supportTicketUpdateSchema,
} from "@/features/platform/schemas";
import {
  adminUpdateTicket,
  deleteTicket,
  updateTicketStatus,
} from "@/features/platform/support";
import { readJsonBody } from "@/features/queue/http";
import { withApiHandler } from "@/lib/errors/api-handler";

type Context = RouteContext<"/api/platform/support/[ticketId]">;

// PATCH { status } — move a ticket through OPEN → IN_PROGRESS → RESOLVED.
export const PATCH = withApiHandler(async (request, context: Context) => {
  const { ticketId } = await context.params;
  const { status } = supportTicketUpdateSchema.parse(
    await readJsonBody(request),
  );
  const ticket = await updateTicketStatus(ticketId, status);
  return Response.json({ ticket });
});

// PUT { subject, body, status } — edit a ticket.
export const PUT = withApiHandler(async (request, context: Context) => {
  const { ticketId } = await context.params;
  const input = supportTicketEditSchema.parse(await readJsonBody(request));
  const ticket = await adminUpdateTicket(ticketId, input);
  return Response.json({ ticket });
});

export const DELETE = withApiHandler(async (_request, context: Context) => {
  const { ticketId } = await context.params;
  await deleteTicket(ticketId);
  return Response.json({ ticketId });
});
