import { clinicNotFound } from "@/features/clinics/access";
import { parseUuid } from "@/features/queue/http";
import { listServices } from "@/features/services/service-admin";
import { listStaff } from "@/features/staff/staff-admin";
import { withApiHandler } from "@/lib/errors/api-handler";

// Doctors with the services they're assigned to.
export const GET = withApiHandler(
  async (
    _request,
    context: RouteContext<"/api/clinics/[clinicId]/doctors">,
  ) => {
    const clinicId = parseUuid((await context.params).clinicId, clinicNotFound);
    const [members, services] = await Promise.all([
      listStaff(clinicId),
      listServices(clinicId),
    ]);
    return Response.json({
      doctors: members.filter((member) => member.role === "DOCTOR"),
      services,
    });
  },
);
