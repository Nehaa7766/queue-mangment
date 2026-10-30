import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "test-only-job-secret-for-outbox-0123456789";

// Set before anything reads the environment (getEnv caches on first use).
vi.stubEnv("INTERNAL_JOB_SECRET", SECRET);

const processOutboxBatch = vi.fn();
// The real worker would claim events other test files create in this shared
// database, so the endpoint is tested against a stand-in.
vi.mock("@/features/notifications/outbox-worker", () => ({
  processOutboxBatch: () => processOutboxBatch(),
}));

const { POST } = await import("@/app/api/internal/outbox/process/route");

function post(authorization?: string) {
  return POST(
    new Request("http://test/api/internal/outbox/process", {
      method: "POST",
      headers: authorization ? { authorization } : {},
    }),
    { params: Promise.resolve({}) },
  );
}

describe("POST /api/internal/outbox/process", () => {
  beforeEach(() => {
    processOutboxBatch.mockReset();
    processOutboxBatch.mockResolvedValue({
      claimed: 2,
      sent: 2,
      retrying: 0,
      failed: 0,
    });
  });

  it("rejects a request without the job token", async () => {
    const response = await post();

    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
    expect(processOutboxBatch).not.toHaveBeenCalled();
  });

  it("rejects a wrong token", async () => {
    const response = await post(`Bearer ${SECRET}x`);

    expect(response.status).toBe(401);
    expect(processOutboxBatch).not.toHaveBeenCalled();
  });

  it("runs one batch with the right token", async () => {
    const response = await post(`Bearer ${SECRET}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      claimed: 2,
      sent: 2,
      retrying: 0,
      failed: 0,
    });
    expect(processOutboxBatch).toHaveBeenCalledOnce();
  });
});
