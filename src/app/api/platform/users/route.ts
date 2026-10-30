import {
  adminCreateSchema,
  USER_TABS,
  type UserTab,
} from "@/features/platform/schemas";
import { addClinicAdmin, listUsers } from "@/features/platform/users";
import { readJsonBody } from "@/features/queue/http";
import { withApiHandler } from "@/lib/errors/api-handler";

// GET ?tab=admins|staff&q=&status=ACTIVE|INACTIVE — super admins only.
export const GET = withApiHandler(async (request) => {
  const params = new URL(request.url).searchParams;
  const tab =
    USER_TABS.find((value) => value === params.get("tab")) ?? "admins";
  const status = params.get("status");
  return Response.json(
    await listUsers({
      tab: tab satisfies UserTab,
      search: params.get("q")?.slice(0, 80),
      status: status === "ACTIVE" || status === "INACTIVE" ? status : undefined,
    }),
  );
});

// POST { name, email, clinicId } — add a clinic admin: a new email gets an
// invitation (link returned once); an existing account joins straight away.
export const POST = withApiHandler(async (request) => {
  const input = adminCreateSchema.parse(await readJsonBody(request));
  return Response.json(await addClinicAdmin(input), { status: 201 });
});
