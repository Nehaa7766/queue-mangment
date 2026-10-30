import { listPlatformActivity } from "@/features/platform/activity";
import { withApiHandler } from "@/lib/errors/api-handler";

// GET — the latest super admin actions, newest first.
export const GET = withApiHandler(async () => {
  return Response.json({ activity: await listPlatformActivity() });
});
