import { connection } from "next/server";
import { requireStaffMember } from "@/features/messaging/access";
import type { UnreadSummary } from "@/features/messaging/contracts";
import { getUnreadSummary } from "@/features/messaging/queries";
import { withApiHandler } from "@/lib/errors/api-handler";

// GET → UnreadSummary for the "Messages" nav badge.
export const GET = withApiHandler(async () => {
  await connection();
  const member = await requireStaffMember();
  return Response.json(
    (await getUnreadSummary(member)) satisfies UnreadSummary,
  );
});
