import { readClinicLogo } from "@/features/clinics/logo";
import { clinicNotFound } from "@/features/queue/errors";
import { withApiHandler } from "@/lib/errors/api-handler";

// A clinic's logo image. Pages add ?v=<updated time>, so the image can be
// cached for a long time and a new upload still shows at once.
export const GET = withApiHandler(
  async (
    request,
    context: RouteContext<"/api/public/clinics/[clinicSlug]/logo">,
  ) => {
    const { clinicSlug } = await context.params;
    const logo = await readClinicLogo(clinicSlug);
    if (!logo) {
      throw clinicNotFound();
    }
    const etag = `"${logo.updatedAt.getTime()}"`;
    const headers = {
      "Content-Type": logo.contentType,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      ETag: etag,
      // Only ever an image: nothing in it may run or load anything.
      "Content-Security-Policy": "default-src 'none'; sandbox",
    };
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers });
    }
    return new Response(new Uint8Array(logo.data), { headers });
  },
);
