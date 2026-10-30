import { clinicNotFound } from "@/features/clinics/access";
import { settingsUpdateSchema } from "@/features/clinics/schemas";
import {
  getClinicSettings,
  updateClinicSettings,
} from "@/features/clinics/settings";
import { parseUuid, readJsonBody } from "@/features/queue/http";
import { withApiHandler } from "@/lib/errors/api-handler";

type Context = RouteContext<"/api/clinics/[clinicId]/settings">;

export const GET = withApiHandler(async (_request, context: Context) => {
  const clinicId = parseUuid((await context.params).clinicId, clinicNotFound);
  return Response.json({ settings: await getClinicSettings(clinicId) });
});

// Saves one section at a time: { section: "profile" | "queue" | "hours", ... }.
export const PATCH = withApiHandler(async (request, context: Context) => {
  const clinicId = parseUuid((await context.params).clinicId, clinicNotFound);
  const update = settingsUpdateSchema.parse(await readJsonBody(request));
  return Response.json({
    settings: await updateClinicSettings(clinicId, update),
  });
});
