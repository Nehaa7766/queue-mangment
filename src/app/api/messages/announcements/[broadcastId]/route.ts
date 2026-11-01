import { requireStaffMember } from "@/features/messaging/access";
import { getBroadcastDetail } from "@/features/messaging/broadcasts";
import type { BroadcastDetail } from "@/features/messaging/contracts";
import { withApiHandler } from "@/lib/errors/api-handler";

// GET → BroadcastDetail: progress and every recipient's status.
export const GET = withApiHandler(
  async (
    _request,
    context: RouteContext<"/api/messages/announcements/[broadcastId]">,
  ) => {
    const member = await requireStaffMember("announcements.send");
    const { broadcastId } = await context.params;
    return Response.json(
      (await getBroadcastDetail(member, broadcastId)) satisfies BroadcastDetail,
    );
  },
);
