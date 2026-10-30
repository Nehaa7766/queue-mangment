import { userStatusUpdateSchema } from "@/features/platform/schemas";
import { setUserStatus } from "@/features/platform/users";
import { readJsonBody } from "@/features/queue/http";
import { withApiHandler } from "@/lib/errors/api-handler";

// PATCH { status: "ACTIVE" | "INACTIVE" } — deactivate or reactivate a user.
export const PATCH = withApiHandler(
  async (request, context: RouteContext<"/api/platform/users/[userId]">) => {
    const { userId } = await context.params;
    const { status } = userStatusUpdateSchema.parse(
      await readJsonBody(request),
    );
    await setUserStatus(userId, status);
    return Response.json({ userId, status });
  },
);
