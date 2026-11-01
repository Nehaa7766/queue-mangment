import { requireStaffChat } from "@/features/messaging/access";
import {
  sendMessageBodySchema,
  type MessagePage,
  type MessageView,
} from "@/features/messaging/contracts";
import { readMessagingBody } from "@/features/messaging/http";
import { staffSendLimiter } from "@/features/messaging/limits";
import { getStaffMessagePage } from "@/features/messaging/queries";
import { findStoredMessage, sendMessage } from "@/features/messaging/service";
import { withApiHandler } from "@/lib/errors/api-handler";
import { enforceRateLimit } from "@/lib/rate-limit";

type Context =
  RouteContext<"/api/messages/conversations/[conversationId]/messages">;

// GET ?before=<messageId> → MessagePage.
export const GET = withApiHandler(async (request, context: Context) => {
  const chat = await requireStaffChat((await context.params).conversationId);
  const before = new URL(request.url).searchParams.get("before");
  return Response.json(
    (await getStaffMessagePage(chat, before)) satisfies MessagePage,
  );
});

// POST SendMessageBody → MessageView (201, or 200 for a retried
// clientMessageId). Access and closing are checked again inside the write.
export const POST = withApiHandler(async (request, context: Context) => {
  const chat = await requireStaffChat((await context.params).conversationId);
  const body = await readMessagingBody(request, sendMessageBodySchema);
  const input = {
    tokenId: chat.token.id,
    channel: chat.conversation.channel,
    author: { kind: "STAFF" as const, member: chat.member },
    clientMessageId: body.clientMessageId,
    body: body.body,
  };

  // A retry of a stored message is answered before the limit counts.
  const stored = await findStoredMessage(input);
  if (!stored) enforceRateLimit(staffSendLimiter, chat.member.userId);
  const result = stored ?? (await sendMessage(input));
  return Response.json(result.message satisfies MessageView, {
    status: result.created ? 201 : 200,
  });
});
