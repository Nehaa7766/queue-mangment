import { getEnv } from "@/lib/env";

// The accounts prisma/seed.sql creates in the local databases, one per
// panel. Keep this list and the seed in step.
export const DEMO_PASSWORD = "queuecare-dev";

export type DemoAccount = { role: string; email: string };

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { role: "Reception", email: "reception@demo-clinic.test" },
  { role: "Doctor", email: "doctor@demo-clinic.test" },
  { role: "Clinic admin", email: "admin@demo-clinic.test" },
  { role: "Super admin", email: "superadmin@queuecare.test" },
];

// Shown in development, or on a demo server with DEMO_LOGINS=true.
export function demoLoginsEnabled(): boolean {
  const env = getEnv();
  return env.NODE_ENV !== "production" || env.DEMO_LOGINS === true;
}
