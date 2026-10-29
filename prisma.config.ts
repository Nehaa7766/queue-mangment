import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Not required for `prisma generate`, so the Docker build works without a database.
    url: process.env.DATABASE_URL ?? "",
  },
});
