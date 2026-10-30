import { describe, expect, it } from "vitest";
import {
  formatWorkingDays,
  hoursSummary,
} from "@/features/platform/clinic-hours";
import {
  CLINIC_BODY_MAX_BYTES,
  readJsonBodyWithin,
} from "@/features/platform/request-body";

function post(body: BodyInit, headers: Record<string, string> = {}) {
  return new Request("http://test/api/platform/clinics", {
    method: "POST",
    body,
    headers,
  });
}

// A body sent in chunks, with no Content-Length to go by.
function streamed(chunks: number, chunkBytes: number) {
  const chunk = new Uint8Array(chunkBytes).fill(0x20);
  let sent = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent === chunks) controller.close();
      else {
        sent += 1;
        controller.enqueue(chunk);
      }
    },
  });
}

async function codeOf(promise: Promise<unknown>) {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return (error as { code?: string }).code;
  }
}

describe("readJsonBodyWithin", () => {
  it("reads a JSON body under the limit, and an empty one as {}", async () => {
    expect(await readJsonBodyWithin(post('{"name":"Sharma"}'), 100)).toEqual({
      name: "Sharma",
    });
    expect(await readJsonBodyWithin(post(""), 100)).toEqual({});
  });

  it("refuses a body that says it is too large", async () => {
    const request = post("{}", {
      "content-length": String(CLINIC_BODY_MAX_BYTES + 1),
    });
    expect(
      await codeOf(readJsonBodyWithin(request, CLINIC_BODY_MAX_BYTES)),
    ).toBe("VALIDATION_ERROR");
  });

  it("stops reading once a body passes the limit", async () => {
    const request = new Request("http://test/api", {
      method: "POST",
      body: streamed(20, 64 * 1024),
      // Node needs this to send a stream.
      duplex: "half",
    } as RequestInit);
    expect(await codeOf(readJsonBodyWithin(request, 1024 * 1024 - 1))).toBe(
      "VALIDATION_ERROR",
    );
  });

  it("allows a logo-sized body: 512 KB of image is about 700 KB as text", async () => {
    const base64 = "A".repeat(Math.ceil((512 * 1024 * 4) / 3));
    const body = JSON.stringify({ logo: { contentType: "image/png", base64 } });
    expect(
      await readJsonBodyWithin(post(body), CLINIC_BODY_MAX_BYTES),
    ).toMatchObject({ logo: { contentType: "image/png" } });
  });

  it("refuses a body that isn't JSON", async () => {
    expect(await codeOf(readJsonBodyWithin(post("not json"), 100))).toBe(
      "VALIDATION_ERROR",
    );
  });
});

describe("clinic hours summary", () => {
  it("joins runs of working days", () => {
    expect(formatWorkingDays(["mon", "tue", "wed", "thu", "fri", "sat"])).toBe(
      "Mon–Sat",
    );
    expect(formatWorkingDays(["sat", "mon", "wed", "thu"])).toBe(
      "Mon, Wed–Thu, Sat",
    );
    expect(
      formatWorkingDays(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
    ).toBe("Every day");
  });

  it("describes simple, custom and missing hours", () => {
    expect(
      hoursSummary({
        kind: "simple",
        hours: {
          openingTime: "09:00",
          closingTime: "18:00",
          workingDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
        },
      }),
    ).toBe("Mon–Sat · 09:00–18:00");
    expect(hoursSummary({ kind: "custom" })).toBe("Custom hours");
    expect(hoursSummary({ kind: "none" })).toBe("Not set");
  });
});
