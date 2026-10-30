import { connection } from "next/server";
import { getAuth } from "@/lib/auth/auth";

// Better Auth's endpoints (sign-in, sign-out, session). The auth instance is
// created per request so `next build` needs no secrets.
async function handle(request: Request): Promise<Response> {
  await connection();
  return getAuth().handler(request);
}

export const GET = handle;
export const POST = handle;
