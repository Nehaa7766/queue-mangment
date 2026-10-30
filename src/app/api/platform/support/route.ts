import { z } from "zod";
import { SUPPORT_STATUSES } from "@/features/platform/schemas";
import { listSupportTickets } from "@/features/platform/support";
import { withApiHandler } from "@/lib/errors/api-handler";

// GET ?status=OPEN|IN_PROGRESS|RESOLVED — super admins only.
export const GET = withApiHandler(async (request) => {
  const status = z
    .enum(SUPPORT_STATUSES)
    .safeParse(new URL(request.url).searchParams.get("status"));
  const tickets = await listSupportTickets({
    status: status.success ? status.data : undefined,
  });
  return Response.json({ tickets });
});
