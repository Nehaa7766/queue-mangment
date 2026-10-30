import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppError } from "@/lib/errors/app-error";
import {
  REQUEST_ID_HEADER,
  toErrorResponse,
  withApiHandler,
} from "@/lib/errors/api-handler";

describe("toErrorResponse", () => {
  it("maps an AppError to its status and stable code", async () => {
    const response = toErrorResponse(
      new AppError("QUEUE_PAUSED", "This queue is temporarily paused."),
      "req-1",
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        code: "QUEUE_PAUSED",
        message: "This queue is temporarily paused.",
        requestId: "req-1",
      },
    });
  });

  it("maps a Zod error to VALIDATION_ERROR", async () => {
    const result = z.object({ name: z.string() }).safeParse({});

    const response = toErrorResponse(result.error, "req-2");

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("hides the details of unknown errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = toErrorResponse(
      new Error("connect ECONNREFUSED 10.0.0.5:5432"),
      "req-3",
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED");
  });
});

describe("withApiHandler", () => {
  const ok = withApiHandler(async () => Response.json({ ok: true }));

  it("keeps a valid incoming request ID", async () => {
    const response = await ok(
      new Request("http://test/api", {
        headers: { [REQUEST_ID_HEADER]: "abc-123" },
      }),
      {},
    );

    expect(response.headers.get(REQUEST_ID_HEADER)).toBe("abc-123");
  });

  it("replaces an unsafe incoming request ID", async () => {
    const response = await ok(
      new Request("http://test/api", {
        headers: { [REQUEST_ID_HEADER]: "<script>alert(1)</script>" },
      }),
      {},
    );

    expect(response.headers.get(REQUEST_ID_HEADER)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("turns a thrown AppError into an error response", async () => {
    const failing = withApiHandler(async () => {
      throw new AppError("FORBIDDEN", "You can't do that.");
    });

    const response = await failing(new Request("http://test/api"), {});

    expect(response.status).toBe(403);
    expect(response.headers.get(REQUEST_ID_HEADER)).toBeTruthy();
  });
});
