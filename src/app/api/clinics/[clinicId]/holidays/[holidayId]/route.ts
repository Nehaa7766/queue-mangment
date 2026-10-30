import { clinicNotFound } from "@/features/clinics/access";
import { removeHoliday } from "@/features/clinics/holidays";
import { parseUuid } from "@/features/queue/http";
import { AppError } from "@/lib/errors/app-error";
import { withApiHandler } from "@/lib/errors/api-handler";

export const DELETE = withApiHandler(
  async (
    _request,
    context: RouteContext<"/api/clinics/[clinicId]/holidays/[holidayId]">,
  ) => {
    const params = await context.params;
    const clinicId = parseUuid(params.clinicId, clinicNotFound);
    const holidayId = parseUuid(
      params.holidayId,
      () => new AppError("VALIDATION_ERROR", "This holiday no longer exists."),
    );
    await removeHoliday(clinicId, holidayId);
    return Response.json({ ok: true });
  },
);
