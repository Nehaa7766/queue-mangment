import { connection } from "next/server";
import { requireStaffMember } from "@/features/messaging/access";
import {
  getBroadcastAudience,
  parseServiceIdsParam,
} from "@/features/messaging/broadcasts";
import type { BroadcastAudience } from "@/features/messaging/contracts";
import { withApiHandler } from "@/lib/errors/api-handler";

// GET ?serviceIds=a,b → BroadcastAudience: how many patients would get an
// announcement now, in total for the choice and per service.
export const GET = withApiHandler(async (request) => {
  await connection();
  const member = await requireStaffMember("announcements.send");
  const serviceIds = parseServiceIdsParam(
    new URL(request.url).searchParams.get("serviceIds"),
  );
  return Response.json(
    (await getBroadcastAudience(
      member,
      serviceIds,
    )) satisfies BroadcastAudience,
  );
});
