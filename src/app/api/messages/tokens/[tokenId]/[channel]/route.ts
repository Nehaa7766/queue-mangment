import { requireStaffToken } from "@/features/messaging/access";
import { readChannel } from "@/features/messaging/http";
import { startConversation } from "@/features/messaging/service";
import { withApiHandler } from "@/lib/errors/api-handler";

// POST → { conversationId }: finds or creates the token's chat on this side,
// e.g. from "Message" on a live queue row. 201 when created, 200 when it
// already existed.
export const POST = withApiHandler(
  async (
    _request,
    context: RouteContext<"/api/messages/tokens/[tokenId]/[channel]">,
  ) => {
    const params = await context.params;
    const channel = readChannel(params.channel);
    const { member, token } = await requireStaffToken(params.tokenId);
    const result = await startConversation(token.id, channel, member);
    return Response.json(
      { conversationId: result.conversationId },
      { status: result.created ? 201 : 200 },
    );
  },
);
