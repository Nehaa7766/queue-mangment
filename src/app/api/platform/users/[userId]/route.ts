import {
  userInputSchema,
  userStatusUpdateSchema,
} from "@/features/platform/schemas";
import {
  deleteUser,
  setUserStatus,
  updateUser,
} from "@/features/platform/users";
import { readJsonBody } from "@/features/queue/http";
import { withApiHandler } from "@/lib/errors/api-handler";

type Context = RouteContext<"/api/platform/users/[userId]">;

// PATCH { status: "ACTIVE" | "INACTIVE" } — deactivate or reactivate a user.
export const PATCH = withApiHandler(async (request, context: Context) => {
  const { userId } = await context.params;
  const { status } = userStatusUpdateSchema.parse(await readJsonBody(request));
  await setUserStatus(userId, status);
  return Response.json({ userId, status });
});

// PUT { name, email } — edit a user's name and email.
export const PUT = withApiHandler(async (request, context: Context) => {
  const { userId } = await context.params;
  const input = userInputSchema.parse(await readJsonBody(request));
  await updateUser(userId, input);
  return Response.json({ userId });
});

// DELETE — only users with no clinic access or history, never yourself.
export const DELETE = withApiHandler(async (_request, context: Context) => {
  const { userId } = await context.params;
  await deleteUser(userId);
  return Response.json({ userId });
});
