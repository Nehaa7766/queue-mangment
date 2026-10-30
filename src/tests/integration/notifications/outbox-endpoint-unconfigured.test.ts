import { expect, it, vi } from "vitest";

// No INTERNAL_JOB_SECRET in this file's environment.
vi.stubEnv("INTERNAL_JOB_SECRET", undefined);

const processOutboxBatch = vi.fn();
vi.mock("@/features/notifications/outbox-worker", () => ({
  processOutboxBatch: () => processOutboxBatch(),
}));

const { POST } = await import("@/app/api/internal/outbox/process/route");

it("refuses every request when no job token is configured", async () => {
  const response = await POST(
    new Request("http://test/api/internal/outbox/process", {
      method: "POST",
      headers: { authorization: "Bearer anything-at-all-0123456789abcdef" },
    }),
    { params: Promise.resolve({}) },
  );

  expect(response.status).toBe(503);
  expect(processOutboxBatch).not.toHaveBeenCalled();
});
