import { supportTicketCreateSchema } from "@/features/platform/schemas";
import {
  createSupportTicket,
  listClinicTickets,
} from "@/features/platform/support";
import { readJsonBody } from "@/features/queue/http";
import { withApiHandler } from "@/lib/errors/api-handler";

// Clinic staff: their clinic's tickets.
export const GET = withApiHandler(async () => {
  return Response.json({ tickets: await listClinicTickets() });
});

// Clinic staff open a ticket for their clinic.
export const POST = withApiHandler(async (request) => {
  const input = supportTicketCreateSchema.parse(await readJsonBody(request));
  const ticket = await createSupportTicket(input);
  return Response.json({ ticket }, { status: 201 });
});
