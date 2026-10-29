import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
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
          env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "" },
          // Tests share one database, so run files one at a time.
          fileParallelism: false,
        },
      },
    ],
  },
});
