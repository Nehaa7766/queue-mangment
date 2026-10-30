import {
  clinicNotFound,
  getClinicDetail,
  setClinicStatus,
} from "@/features/platform/clinics";
import { clinicStatusUpdateSchema } from "@/features/platform/schemas";
import { readJsonBody } from "@/features/queue/http";
import { withApiHandler } from "@/lib/errors/api-handler";

type Context = RouteContext<"/api/platform/clinics/[clinicId]">;

export const GET = withApiHandler(async (_request, context: Context) => {
  const clinic = await getClinicDetail((await context.params).clinicId);
  if (!clinic) throw clinicNotFound();
  return Response.json({ clinic });
});

// PATCH { status: "ACTIVE" | "INACTIVE" } — activate (approve) or suspend.
export const PATCH = withApiHandler(async (request, context: Context) => {
  const { clinicId } = await context.params;
  const { status } = clinicStatusUpdateSchema.parse(
    await readJsonBody(request),
  );
  await setClinicStatus(clinicId, status);
  const clinic = await getClinicDetail(clinicId);
  return Response.json({ clinic });
});
