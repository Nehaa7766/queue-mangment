import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // Resolve the @/* alias from tsconfig.json.
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/tests/unit/**/*.test.{ts,tsx}"],
          environment: "jsdom",
          setupFiles: ["src/tests/setup-dom.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["src/tests/integration/**/*.test.ts"],
          environment: "node",
          // Integration tests always run against the separate test database.
          // getEnv() validates every variable, so auth needs test values too.
          env: {
            DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
            BETTER_AUTH_SECRET:
              process.env.BETTER_AUTH_SECRET ??
              "test-only-secret-0123456789abcdef0123456789",
            BETTER_AUTH_URL:
              process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
            // As if behind a reverse proxy, so tests can act as different clients.
            TRUSTED_IP_HEADER: "x-forwarded-for",
          },
          // Tests share one database, so run files one at a time.
          fileParallelism: false,
        },
      },
    ],
  },
});
