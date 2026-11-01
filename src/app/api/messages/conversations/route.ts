import { connection } from "next/server";
import { requireStaffMember } from "@/features/messaging/access";
import type { InboxPage } from "@/features/messaging/contracts";
import { getInbox, parseInboxQuery } from "@/features/messaging/queries";
import { withApiHandler } from "@/lib/errors/api-handler";

// GET ?filter=<all|unread|open|closed>&channel=<reception|doctor>&q=&cursor=
// → InboxPage: only chats the signed-in staff member may see right now.
export const GET = withApiHandler(async (request) => {
  await connection();
  const member = await requireStaffMember();
  const query = parseInboxQuery(new URL(request.url).searchParams);
  return Response.json((await getInbox(member, query)) satisfies InboxPage);
});
