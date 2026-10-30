import { getAuditLog } from "@/features/analytics/admin-queries";
import { parseAuditFilters } from "@/features/analytics/audit-log";
import { clinicNotFound } from "@/features/clinics/access";
import { parseUuid } from "@/features/queue/http";
import { withApiHandler } from "@/lib/errors/api-handler";

// Audit trail with optional ?date=YYYY-MM-DD&actor=<userId>&category=<area>.
export const GET = withApiHandler(
  async (request, context: RouteContext<"/api/clinics/[clinicId]/audit">) => {
    const clinicId = parseUuid((await context.params).clinicId, clinicNotFound);
    const params = new URL(request.url).searchParams;
    const log = await getAuditLog(
      clinicId,
      parseAuditFilters({
        date: params.get("date"),
        actor: params.get("actor"),
        category: params.get("category"),
      }),
    );
    return Response.json(log);
  },
);
