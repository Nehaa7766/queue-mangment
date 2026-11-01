import { findPatientToken } from "@/features/messaging/access";
import { readChannel } from "@/features/messaging/http";
import { markConversationRead } from "@/features/messaging/service";
import { getDb } from "@/lib/db";
import { withApiHandler } from "@/lib/errors/api-handler";

// POST → { ok: true }. The patient opened the chat: staff see "Seen".
// Nothing to do before the first message.
export const POST = withApiHandler(
  async (
    _request,
    context: RouteContext<"/api/public/tokens/[publicTokenId]/messages/[channel]/read">,
  ) => {
    const params = await context.params;
    const channel = readChannel(params.channel);
    const token = await findPatientToken(params.publicTokenId);
    const conversation = await getDb().conversation.findUnique({
      where: { tokenId_channel: { tokenId: token.id, channel } },
      select: { id: true },
    });
    if (conversation) {
      await markConversationRead(conversation.id, "PATIENT");
    }
    return Response.json({ ok: true });
  },
);
