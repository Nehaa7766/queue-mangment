import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getEnv } from "@/lib/env";

const globalForDb = globalThis as unknown as { db?: PrismaClient };

// One shared client, created on first use. Kept on globalThis so hot reloads
// in development don't open a new connection pool on every edit.
export function getDb(): PrismaClient {
  if (!globalForDb.db) {
    const adapter = new PrismaPg({ connectionString: getEnv().DATABASE_URL });
    globalForDb.db = new PrismaClient({ adapter });
  }
  return globalForDb.db;
}
