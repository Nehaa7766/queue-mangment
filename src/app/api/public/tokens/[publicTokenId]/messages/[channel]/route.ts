import { findPatientToken } from "@/features/messaging/access";
import {
  sendMessageBodySchema,
  type MessagePage,
  type MessageView,
} from "@/features/messaging/contracts";
import { readChannel, readMessagingBody } from "@/features/messaging/http";
import { patientSendLimiter } from "@/features/messaging/limits";
import { getPatientMessagePage } from "@/features/messaging/queries";
import { findStoredMessage, sendMessage } from "@/features/messaging/service";
import { withApiHandler } from "@/lib/errors/api-handler";
import { enforceRateLimit } from "@/lib/rate-limit";

type Context =
  RouteContext<"/api/public/tokens/[publicTokenId]/messages/[channel]">;

// GET ?before=<messageId> → MessagePage for the patient's own chat.
export const GET = withApiHandler(async (request, context: Context) => {
  const params = await context.params;
  const channel = readChannel(params.channel);
  const before = new URL(request.url).searchParams.get("before");
  const page = await getPatientMessagePage(
    params.publicTokenId,
    channel,
    before,
  );
  return Response.json(page satisfies MessagePage);
});

// POST SendMessageBody → MessageView. 201 when stored, 200 when a retry with
// the same clientMessageId returns the stored message.
export const POST = withApiHandler(async (request, context: Context) => {
  const params = await context.params;
  const channel = readChannel(params.channel);
  const token = await findPatientToken(params.publicTokenId);
  const body = await readMessagingBody(request, sendMessageBodySchema);
  const input = {
    tokenId: token.id,
    channel,
    author: { kind: "PATIENT" as const },
    clientMessageId: body.clientMessageId,
    body: body.body,
  };

  // A retry of a stored message is answered before the limit counts.
  const stored = await findStoredMessage(input);
  if (!stored) enforceRateLimit(patientSendLimiter, token.id);
  const result = stored ?? (await sendMessage(input));
  return Response.json(result.message satisfies MessageView, {
    status: result.created ? 201 : 200,
  });
});
