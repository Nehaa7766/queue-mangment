import type { DoctorPanelResponse } from "@/features/doctor/contracts";
import { getDoctorPanelView } from "@/features/doctor/queries";
import type { DoctorQueueResponse } from "@/features/queue/contracts";
import { withApiHandler } from "@/lib/errors/api-handler";

// The signed-in doctor's live panel for today. Optional ?clinicId= picks the
// clinic; the response still satisfies the Phase 3 DoctorQueueResponse.
export const GET = withApiHandler(async (request) => {
  const clinicId = new URL(request.url).searchParams.get("clinicId");
  const view = await getDoctorPanelView(clinicId ?? undefined);
  return Response.json(
    view satisfies DoctorPanelResponse satisfies DoctorQueueResponse,
  );
});
