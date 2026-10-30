import { availabilityBodySchema } from "@/features/doctor/availability";
import type { DoctorAvailabilityResponse } from "@/features/doctor/contracts";
import { updateDoctorAvailability } from "@/features/doctor/service";
import { readJsonBody } from "@/features/queue/http";
import { withApiHandler } from "@/lib/errors/api-handler";

// POST /api/doctor/availability — the signed-in doctor sets Available,
// On break or Off duty, an announced delay and a short note.
export const POST = withApiHandler(async (request) => {
  const update = availabilityBodySchema.parse(await readJsonBody(request));
  const clinicId = new URL(request.url).searchParams.get("clinicId");
  const doctor = await updateDoctorAvailability(update, clinicId ?? undefined);
  return Response.json({ doctor } satisfies DoctorAvailabilityResponse);
});
