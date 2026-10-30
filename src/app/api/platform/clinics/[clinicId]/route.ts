import {
  clinicNotFound,
  deleteClinic,
  getClinicDetail,
  setClinicStatus,
  updateClinic,
} from "@/features/platform/clinics";
import {
  clinicDeleteSchema,
  clinicDetailsSchema,
  clinicStatusUpdateSchema,
} from "@/features/platform/schemas";
import {
  CLINIC_BODY_MAX_BYTES,
  readJsonBodyWithin,
} from "@/features/platform/request-body";
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

// PUT — edit the clinic's profile, hours and logo. Bodies over 1 MB are
// refused.
export const PUT = withApiHandler(async (request, context: Context) => {
  const { clinicId } = await context.params;
  const input = clinicDetailsSchema.parse(
    await readJsonBodyWithin(request, CLINIC_BODY_MAX_BYTES),
  );
  await updateClinic(clinicId, input);
  const clinic = await getClinicDetail(clinicId);
  return Response.json({ clinic });
});

// DELETE { confirmSlug } — only clinics with no patient history.
export const DELETE = withApiHandler(async (request, context: Context) => {
  const { clinicId } = await context.params;
  const { confirmSlug } = clinicDeleteSchema.parse(await readJsonBody(request));
  return Response.json(await deleteClinic(clinicId, confirmSlug));
});
