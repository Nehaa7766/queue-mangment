import {
  acceptInvitation,
  acceptInvitationSchema,
} from "@/features/invitations/invitations";
import { invitationTokenSchema } from "@/features/invitations/tokens";
import { clientIp, readJsonBody } from "@/features/queue/http";
import { AppError } from "@/lib/errors/app-error";
import { withApiHandler } from "@/lib/errors/api-handler";
import { createRateLimiter, enforceRateLimit } from "@/lib/rate-limit";

// Public: the link itself is the credential, so slow down guessing.
const acceptLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

export const POST = withApiHandler(
  async (request, context: RouteContext<"/api/invitations/[token]/accept">) => {
    enforceRateLimit(acceptLimiter, clientIp(request));
    const token = invitationTokenSchema.safeParse((await context.params).token);
    if (!token.success) {
      throw new AppError(
        "VALIDATION_ERROR",
        "This invitation link isn't valid. Ask your clinic admin for a new one.",
      );
    }
    const input = acceptInvitationSchema.parse(await readJsonBody(request));
    return Response.json(await acceptInvitation(token.data, input));
  },
);
