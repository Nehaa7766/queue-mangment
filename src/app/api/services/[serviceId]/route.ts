import { parseUuid, readJsonBody } from "@/features/queue/http";
import {
  serviceNotFound,
  serviceUpdateSchema,
  updateService,
} from "@/features/services/service-admin";
import { withApiHandler } from "@/lib/errors/api-handler";

type Context = RouteContext<"/api/services/[serviceId]">;

// Edit a service, or turn it off or on with { isActive }.
export const PATCH = withApiHandler(async (request, context: Context) => {
  const serviceId = parseUuid(
    (await context.params).serviceId,
    serviceNotFound,
  );
  const update = serviceUpdateSchema.parse(await readJsonBody(request));
  return Response.json({ service: await updateService(serviceId, update) });
});

// Services are never deleted: DELETE turns one off and keeps its history.
export const DELETE = withApiHandler(async (_request, context: Context) => {
  const serviceId = parseUuid(
    (await context.params).serviceId,
    serviceNotFound,
  );
  return Response.json({
    service: await updateService(serviceId, { isActive: false }),
  });
});
