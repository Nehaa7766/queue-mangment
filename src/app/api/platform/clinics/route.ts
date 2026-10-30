import { z } from "zod";
import { listClinics } from "@/features/platform/clinics";
import { CLINIC_FILTERS } from "@/features/platform/schemas";
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
