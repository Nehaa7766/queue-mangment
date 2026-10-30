import { z } from "zod";
import { ANALYTICS_RANGES } from "@/features/analytics/admin-analytics";
import { getAdminAnalytics } from "@/features/analytics/admin-queries";
import { clinicNotFound } from "@/features/clinics/access";
import { parseUuid } from "@/features/queue/http";
import { withApiHandler } from "@/lib/errors/api-handler";

const rangeSchema = z.enum(ANALYTICS_RANGES).catch("7d");

// Pilot metrics for ?range=today|7d|30d (default 7d).
export const GET = withApiHandler(
  async (
    request,
    context: RouteContext<"/api/clinics/[clinicId]/analytics">,
  ) => {
    const clinicId = parseUuid((await context.params).clinicId, clinicNotFound);
    const range = rangeSchema.parse(
      new URL(request.url).searchParams.get("range"),
    );
    return Response.json(await getAdminAnalytics(clinicId, range));
  },
);
