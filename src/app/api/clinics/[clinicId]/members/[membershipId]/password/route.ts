import { clinicNotFound } from "@/features/clinics/access";
import { parseUuid, readJsonBody } from "@/features/queue/http";
import {
  memberNotFound,
  passwordResetSchema,
  resetMemberPassword,
} from "@/features/staff/staff-admin";
import { withApiHandler } from "@/lib/errors/api-handler";

// A clinic admin sets a new password for a member; their sessions end.
export const POST = withApiHandler(
  async (
    request,
    context: RouteContext<"/api/clinics/[clinicId]/members/[membershipId]/password">,
  ) => {
    const params = await context.params;
    const clinicId = parseUuid(params.clinicId, clinicNotFound);
    const membershipId = parseUuid(params.membershipId, memberNotFound);
    const { password } = passwordResetSchema.parse(await readJsonBody(request));
    await resetMemberPassword(clinicId, membershipId, password);
    return Response.json({ ok: true });
  },
);
