import { createAuthClient } from "better-auth/react";

// Browser client for the Better Auth endpoints under /api/auth. Sign-in goes
// through HTTP (not a server action) so Better Auth's rate limit applies.
export const authClient = createAuthClient();
