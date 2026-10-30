import { z } from "zod";
import { getDashboardView } from "@/features/analytics/queries";
import { withApiHandler } from "@/lib/errors/api-handler";

// Receptionist dashboard data. getDashboardView loads the clinic and checks
// the caller's membership before reading anything else.
export const GET = withApiHandler<
  RouteContext<"/api/clinics/[clinicId]/dashboard">
>(async (_request, context) => {
  const { clinicId } = await context.params;
  const view = await getDashboardView(z.uuid().parse(clinicId));
  return Response.json(view);
});
