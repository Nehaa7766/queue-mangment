import { clinicNotFound } from "@/features/clinics/access";
import { revokeInvitation } from "@/features/invitations/invitations";
import { parseUuid } from "@/features/queue/http";
import { AppError } from "@/lib/errors/app-error";
import { withApiHandler } from "@/lib/errors/api-handler";

// Cancels an invitation so its link stops working.
export const DELETE = withApiHandler(
  async (
    _request,
    context: RouteContext<"/api/clinics/[clinicId]/invitations/[invitationId]">,
  ) => {
    const params = await context.params;
    const clinicId = parseUuid(params.clinicId, clinicNotFound);
    const invitationId = parseUuid(
      params.invitationId,
      () => new AppError("VALIDATION_ERROR", "This invitation wasn't found."),
    );
    await revokeInvitation(clinicId, invitationId);
    return Response.json({ ok: true });
  },
);
