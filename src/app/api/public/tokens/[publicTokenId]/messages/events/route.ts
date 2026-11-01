import { connection } from "next/server";
import { findPatientToken } from "@/features/messaging/access";
import { MAX_STREAMS_PER_TOKEN } from "@/features/messaging/limits";
import { openMessagingStream } from "@/features/messaging/live";
import { patientEventFor } from "@/features/messaging/rules";
import { withApiHandler } from "@/lib/errors/api-handler";

// GET text/event-stream: hints (never message text) for this token's chats.
// The screen refetches through REST on each hint and on every reconnect.
export const GET = withApiHandler(
  async (
    request,
    context: RouteContext<"/api/public/tokens/[publicTokenId]/messages/events">,
  ) => {
    await connection();
    const { publicTokenId } = await context.params;
    const token = await findPatientToken(publicTokenId);
    return openMessagingStream({
      signal: request.signal,
      capKey: `token:${token.id}`,
      cap: MAX_STREAMS_PER_TOKEN,
      match: (notification) => patientEventFor(token.id, notification),
    });
  },
);
