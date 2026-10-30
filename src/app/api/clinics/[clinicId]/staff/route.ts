import { clinicNotFound } from "@/features/clinics/access";
import { listPendingInvitations } from "@/features/invitations/invitations";
import { parseUuid } from "@/features/queue/http";
import { listStaff } from "@/features/staff/staff-admin";
import { withApiHandler } from "@/lib/errors/api-handler";

// Members of the clinic and invitations still waiting to be accepted.
export const GET = withApiHandler(
  async (_request, context: RouteContext<"/api/clinics/[clinicId]/staff">) => {
    const clinicId = parseUuid((await context.params).clinicId, clinicNotFound);
    const [members, invitations] = await Promise.all([
      listStaff(clinicId),
      listPendingInvitations(clinicId),
    ]);
    return Response.json({ members, invitations });
  },
);
