import { listUsers } from "@/features/platform/users";
import { withApiHandler } from "@/lib/errors/api-handler";

// GET ?q= — super admins only.
export const GET = withApiHandler(async (request) => {
  const search = new URL(request.url).searchParams.get("q")?.slice(0, 80);
  return Response.json({ users: await listUsers({ search }) });
});
