import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { withApiHandler } from "@/lib/errors/api-handler";
import { logError } from "@/lib/log";

export const GET = withApiHandler(async (_request, _context, requestId) => {
  // Always check at request time; never prerender this at build.
  await connection();

  try {
    await getDb().$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", database: "ok" });
  } catch (error) {
    logError("Health check: database unreachable", { requestId, error });
    return Response.json(
      { status: "error", database: "unreachable" },
      { status: 503 },
    );
  }
});
