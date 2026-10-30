import { clinicNotFound } from "@/features/clinics/access";
import { parseUuid, readJsonBody } from "@/features/queue/http";
import {
  createService,
  listServices,
  serviceInputSchema,
} from "@/features/services/service-admin";
import { withApiHandler } from "@/lib/errors/api-handler";

type Context = RouteContext<"/api/clinics/[clinicId]/services">;

// Every service, including turned-off ones. Clinic admins only.
export const GET = withApiHandler(async (_request, context: Context) => {
  const clinicId = parseUuid((await context.params).clinicId, clinicNotFound);
  return Response.json({ services: await listServices(clinicId) });
});

export const POST = withApiHandler(async (request, context: Context) => {
  const clinicId = parseUuid((await context.params).clinicId, clinicNotFound);
  const input = serviceInputSchema.parse(await readJsonBody(request));
  const service = await createService(clinicId, input);
  return Response.json({ service }, { status: 201 });
});
