import { z } from "zod";
import { checkClinicSlug } from "@/features/platform/clinics";
import { withApiHandler } from "@/lib/errors/api-handler";

// GET ?slug=&except=<clinicId> — is this address free? `except` lets a
// clinic being edited keep its own address. Super admins only.
export const GET = withApiHandler(async (request) => {
  const params = new URL(request.url).searchParams;
  const slug = (params.get("slug") ?? "").slice(0, 80);
  const except = z.uuid().safeParse(params.get("except"));
  const check = await checkClinicSlug(
    slug,
    except.success ? except.data : undefined,
  );
  return Response.json({ slug, ...check });
});
