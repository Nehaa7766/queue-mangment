import type { PublicClinicResponse } from "@/features/queue/contracts";
import { clinicNotFound } from "@/features/queue/errors";
import { getPublicClinicView } from "@/features/queue/queries";
import { withApiHandler } from "@/lib/errors/api-handler";

// Public clinic page data: clinic details and active services with today's queues.
export const GET = withApiHandler(
  async (
    _request,
    context: RouteContext<"/api/public/clinics/[clinicSlug]">,
  ) => {
    const { clinicSlug } = await context.params;
    const clinic = await getPublicClinicView(clinicSlug);
    if (!clinic) {
      throw clinicNotFound();
    }
    return Response.json(clinic satisfies PublicClinicResponse);
  },
);
