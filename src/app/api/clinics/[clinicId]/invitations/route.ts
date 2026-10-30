import { clinicNotFound } from "@/features/clinics/access";
import {
  createInvitation,
  invitationInputSchema,
  listPendingInvitations,
} from "@/features/invitations/invitations";
import { parseUuid, readJsonBody } from "@/features/queue/http";
import { withApiHandler } from "@/lib/errors/api-handler";

type Context = RouteContext<"/api/clinics/[clinicId]/invitations">;

export const GET = withApiHandler(async (_request, context: Context) => {
  const clinicId = parseUuid((await context.params).clinicId, clinicNotFound);
  return Response.json({
    invitations: await listPendingInvitations(clinicId),
  });
});

// Creates the invitation and queues its email. The response also carries the
// accept link, so the admin can share it before email is set up.
export const POST = withApiHandler(async (request, context: Context) => {
  const clinicId = parseUuid((await context.params).clinicId, clinicNotFound);
  const input = invitationInputSchema.parse(await readJsonBody(request));
  return Response.json(await createInvitation(clinicId, input), {
    status: 201,
  });
});
