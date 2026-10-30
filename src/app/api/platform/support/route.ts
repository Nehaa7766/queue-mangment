import { z } from "zod";
import {
  SUPPORT_STATUSES,
  supportTicketAdminCreateSchema,
} from "@/features/platform/schemas";
import {
  adminCreateTicket,
  listSupportTickets,
} from "@/features/platform/support";
import { readJsonBody } from "@/features/queue/http";
import { withApiHandler } from "@/lib/errors/api-handler";

// GET ?status=OPEN|IN_PROGRESS|RESOLVED — super admins only.
export const GET = withApiHandler(async (request) => {
  const status = z
    .enum(SUPPORT_STATUSES)
    .safeParse(new URL(request.url).searchParams.get("status"));
  const tickets = await listSupportTickets({
    status: status.success ? status.data : undefined,
  });
  return Response.json({ tickets });
});

// POST { clinicId | null, subject, body, status } — open a ticket on a
// clinic's behalf.
export const POST = withApiHandler(async (request) => {
  const input = supportTicketAdminCreateSchema.parse(
    await readJsonBody(request),
  );
  const ticket = await adminCreateTicket(input);
  return Response.json({ ticket }, { status: 201 });
});
