import { requireStaffChat } from "@/features/messaging/access";
import { markConversationRead } from "@/features/messaging/service";
import { withApiHandler } from "@/lib/errors/api-handler";

// POST → { ok: true }. Staff opened the chat: the patient sees "Seen".
export const POST = withApiHandler(
  async (
    _request,
    context: RouteContext<"/api/messages/conversations/[conversationId]/read">,
  ) => {
    const chat = await requireStaffChat((await context.params).conversationId);
    await markConversationRead(chat.conversation.id, "STAFF");
    return Response.json({ ok: true });
  },
);
