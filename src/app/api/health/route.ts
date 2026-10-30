import { connection } from "next/server";
import { checkInternalJobAuth } from "@/features/retention/internal-job-auth";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { withApiHandler } from "@/lib/errors/api-handler";
import { logError } from "@/lib/log";
import { getOutboxHealth } from "./outbox";

export const GET = withApiHandler(async (request, _context, requestId) => {
  // Always check at request time; never prerender this at build.
  await connection();

  try {
    await getDb().$queryRaw`SELECT 1`;
  } catch (error) {
    logError("Health check: database unreachable", { requestId, error });
    return Response.json(
      { status: "error", database: "unreachable" },
      { status: 503 },
    );
  }

  // Monitoring gets backlog counts with the internal job token; the public
  // answer stays minimal so it reveals nothing about traffic.
  if (checkInternalJobAuth(request, getEnv().INTERNAL_JOB_SECRET) === "ok") {
    return Response.json({
      status: "ok",
      database: "ok",
      outbox: await getOutboxHealth(),
    });
  }
  return Response.json({ status: "ok", database: "ok" });
});
