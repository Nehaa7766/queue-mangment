import { describe, expect, it } from "vitest";
import { IDEMPOTENCY_KEY_HEADER } from "@/features/queue/contracts";
import { queueNotFound } from "@/features/queue/errors";
import {
  clientIp,
  parseUuid,
  readIdempotencyKey,
  readJsonBody,
} from "@/features/queue/http";
import { errorCodeOf } from "./helpers";

describe("parseUuid", () => {
  it("accepts a UUID and turns anything else into the not-found error", () => {
    const id = crypto.randomUUID();

    expect(parseUuid(id, queueNotFound)).toBe(id);
    expect(errorCodeOf(() => parseUuid("1 OR 1=1", queueNotFound))).toBe(
      "QUEUE_NOT_FOUND",
    );
  });
});

describe("readIdempotencyKey", () => {
  it("reads a valid key and rejects a missing one", () => {
    const key = crypto.randomUUID();
    const withKey = new Request("http://test", {
      headers: { [IDEMPOTENCY_KEY_HEADER]: key },
    });

    expect(readIdempotencyKey(withKey)).toBe(key);
    expect(
      errorCodeOf(() => readIdempotencyKey(new Request("http://test"))),
    ).toBe("VALIDATION_ERROR");
  });
});

describe("readJsonBody", () => {
  it("treats an empty body as {}", async () => {
    const request = new Request("http://test", { method: "POST" });

    expect(await readJsonBody(request)).toEqual({});
  });

  it("rejects a body that is not JSON", async () => {
    const request = new Request("http://test", {
      method: "POST",
      body: "{oops",
    });

    await expect(readJsonBody(request)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });
});

describe("clientIp", () => {
  // The client wrote the first entry; the trusted proxy appended the last.
  const forwarded = new Request("http://test", {
    headers: { "x-forwarded-for": "198.51.100.9, 203.0.113.7" },
  });

  it("uses the address the trusted proxy appended", () => {
    expect(clientIp(forwarded, "x-forwarded-for")).toBe("203.0.113.7");
  });

  it("ignores client headers when no trusted proxy is configured", () => {
    expect(clientIp(forwarded, null)).toBe("unknown");
  });

  it("falls back when the trusted header is missing", () => {
    expect(clientIp(new Request("http://test"), "x-forwarded-for")).toBe(
      "unknown",
    );
  });
});
