import type { PatientMessagingSummary } from "@/features/messaging/contracts";
import { getPatientSummary } from "@/features/messaging/queries";
import { withApiHandler } from "@/lib/errors/api-handler";

// The patient's two chats (Reception and Doctor) for the token page tabs.
// The private token link is the credential (docs/MESSAGING.md).
export const GET = withApiHandler(
  async (
    _request,
    context: RouteContext<"/api/public/tokens/[publicTokenId]/messages">,
  ) => {
    const { publicTokenId } = await context.params;
    const summary = await getPatientSummary(publicTokenId);
    return Response.json(summary satisfies PatientMessagingSummary);
  },
);
