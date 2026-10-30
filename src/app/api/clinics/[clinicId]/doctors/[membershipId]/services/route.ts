import { clinicNotFound } from "@/features/clinics/access";
import { parseUuid, readJsonBody } from "@/features/queue/http";
import {
  doctorServicesSchema,
  memberNotFound,
  setDoctorServices,
} from "@/features/staff/staff-admin";
import { withApiHandler } from "@/lib/errors/api-handler";

// Replace the services a doctor serves. An empty list means every service.
export const PUT = withApiHandler(
  async (
    request,
    context: RouteContext<"/api/clinics/[clinicId]/doctors/[membershipId]/services">,
  ) => {
    const params = await context.params;
    const clinicId = parseUuid(params.clinicId, clinicNotFound);
    const membershipId = parseUuid(params.membershipId, memberNotFound);
    const { serviceIds } = doctorServicesSchema.parse(
      await readJsonBody(request),
    );
    await setDoctorServices(clinicId, membershipId, serviceIds);
    return Response.json({ ok: true });
  },
);
