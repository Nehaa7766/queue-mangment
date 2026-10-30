import { sendUserPasswordReset } from "@/features/platform/users";
import { withApiHandler } from "@/lib/errors/api-handler";

// POST — email the user a link to choose a new password.
export const POST = withApiHandler(
  async (
    _request,
    context: RouteContext<"/api/platform/users/[userId]/password-reset">,
  ) => {
    const { userId } = await context.params;
    await sendUserPasswordReset(userId);
    return Response.json({ userId, sent: true });
  },
);
