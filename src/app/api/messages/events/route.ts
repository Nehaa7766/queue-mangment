import { connection } from "next/server";
import { requireStaffMember } from "@/features/messaging/access";
import { MAX_STREAMS_PER_STAFF } from "@/features/messaging/limits";
import { openMessagingStream } from "@/features/messaging/live";
import { staffEventFor } from "@/features/messaging/rules";
import { withApiHandler } from "@/lib/errors/api-handler";

// GET text/event-stream: hints for the chats and announcements this staff
// member may see. Role, user id and doctor services are loaded once here;
// the stream ends after a few minutes so they are loaded again on reconnect.
export const GET = withApiHandler(async (request) => {
  await connection();
  const member = await requireStaffMember();
  return openMessagingStream({
    signal: request.signal,
    capKey: `staff:${member.userId}`,
    cap: MAX_STREAMS_PER_STAFF,
    match: (notification) => staffEventFor(member, notification),
  });
});
