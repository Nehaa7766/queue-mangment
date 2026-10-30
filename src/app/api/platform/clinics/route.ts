import { z } from "zod";
import { createClinic, listClinics } from "@/features/platform/clinics";
import {
  CLINIC_FILTERS,
  clinicCreateSchema,
} from "@/features/platform/schemas";
import {
  CLINIC_BODY_MAX_BYTES,
  readJsonBodyWithin,
} from "@/features/platform/request-body";
import { withApiHandler } from "@/lib/errors/api-handler";

// GET ?q=&status=ACTIVE|PENDING|SUSPENDED — super admins only.
export const GET = withApiHandler(async (request) => {
  const params = new URL(request.url).searchParams;
  const lifecycle = z.enum(CLINIC_FILTERS).safeParse(params.get("status"));
  const clinics = await listClinics({
    search: params.get("q")?.slice(0, 80) ?? undefined,
    lifecycle: lifecycle.success ? lifecycle.data : undefined,
  });
  return Response.json({ clinics });
});

// POST — add a clinic with its profile, hours, optional logo, first service
// and first admin. Bodies over 1 MB are refused.
export const POST = withApiHandler(async (request) => {
  const input = clinicCreateSchema.parse(
    await readJsonBodyWithin(request, CLINIC_BODY_MAX_BYTES),
  );
  const result = await createClinic(input);
  return Response.json(result, { status: 201 });
});
