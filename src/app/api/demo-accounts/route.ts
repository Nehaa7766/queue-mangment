import { connection } from "next/server";
import {
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  demoLoginsEnabled,
} from "@/lib/auth/demo-accounts";
import { withApiHandler } from "@/lib/errors/api-handler";

// The seeded demo accounts for the sign-in page's "Demo accounts" box: the
// list in development or with DEMO_LOGINS=true, otherwise an empty list.
// The page fetches this after loading, so the page itself stays static.
export const GET = withApiHandler(async () => {
  await connection();

  const body = demoLoginsEnabled()
    ? { accounts: DEMO_ACCOUNTS, password: DEMO_PASSWORD }
    : { accounts: [], password: null };
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
});
