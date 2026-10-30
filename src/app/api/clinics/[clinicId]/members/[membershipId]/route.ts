import { clinicNotFound } from "@/features/clinics/access";
import { parseUuid, readJsonBody } from "@/features/queue/http";
import {
  memberNotFound,
  memberUpdateSchema,
  updateMember,
} from "@/features/staff/staff-admin";
import { withApiHandler } from "@/lib/errors/api-handler";

// Change a member's role, or remove or restore their access.
export const PATCH = withApiHandler(
  async (
    request,
    context: RouteContext<"/api/clinics/[clinicId]/members/[membershipId]">,
  ) => {
    const params = await context.params;
    const clinicId = parseUuid(params.clinicId, clinicNotFound);
    const membershipId = parseUuid(params.membershipId, memberNotFound);
    const update = memberUpdateSchema.parse(await readJsonBody(request));
    await updateMember(clinicId, membershipId, update);
    return Response.json({ ok: true });
  },
);
