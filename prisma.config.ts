import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Plain SQL so seeding needs no TypeScript loader; safe to run repeatedly.
    seed: "prisma db execute --file prisma/seed.sql",
  },
  datasource: {
    // Not required for `prisma generate`, so the Docker build works without a database.
    url: process.env.DATABASE_URL ?? "",
  },
});
