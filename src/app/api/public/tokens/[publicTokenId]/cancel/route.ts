import type { PublicTokenResponse } from "@/features/queue/contracts";
import { tokenNotFound } from "@/features/queue/errors";
import { getPublicTokenView } from "@/features/queue/queries";
import { cancelByPatient } from "@/features/queue/service";
import { withApiHandler } from "@/lib/errors/api-handler";

// The patient leaves the queue. Knowing the unguessable public token ID is
// what allows it; there is no patient login.
export const POST = withApiHandler(
  async (
    _request,
    context: RouteContext<"/api/public/tokens/[publicTokenId]/cancel">,
  ) => {
    const { publicTokenId } = await context.params;
    await cancelByPatient(publicTokenId);
    const token = await getPublicTokenView(publicTokenId);
    if (!token) {
      throw tokenNotFound();
    }
    return Response.json({ token } satisfies PublicTokenResponse);
  },
);
