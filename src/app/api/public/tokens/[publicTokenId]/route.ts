import type { PublicTokenResponse } from "@/features/queue/contracts";
import { tokenNotFound } from "@/features/queue/errors";
import { getPublicTokenView } from "@/features/queue/queries";
import { withApiHandler } from "@/lib/errors/api-handler";

// Minimal token status for the patient's phone (docs/PLAN.md §9 rule 17).
export const GET = withApiHandler(
  async (
    _request,
    context: RouteContext<"/api/public/tokens/[publicTokenId]">,
  ) => {
    const { publicTokenId } = await context.params;
    const token = await getPublicTokenView(publicTokenId);
    if (!token) {
      throw tokenNotFound();
    }
    return Response.json({ token } satisfies PublicTokenResponse);
  },
);
