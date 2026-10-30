// @vitest-environment node
import { describe, expect, it } from "vitest";
import { checkInternalJobAuth } from "@/features/retention/internal-job-auth";

const SECRET = "job-secret-0123456789abcdef0123456789";

function withAuthorization(value?: string): Request {
  return new Request("http://test/api/internal/retention/run", {
    method: "POST",
    headers: value ? { authorization: value } : {},
  });
}

describe("checkInternalJobAuth", () => {
  it("accepts the configured bearer token", () => {
    expect(
      checkInternalJobAuth(withAuthorization(`Bearer ${SECRET}`), SECRET),
    ).toBe("ok");
  });

  it("refuses a missing, malformed or wrong token", () => {
    expect(checkInternalJobAuth(withAuthorization(), SECRET)).toBe("denied");
    expect(checkInternalJobAuth(withAuthorization(SECRET), SECRET)).toBe(
      "denied",
    );
    expect(
      checkInternalJobAuth(withAuthorization(`Basic ${SECRET}`), SECRET),
    ).toBe("denied");
    expect(
      checkInternalJobAuth(withAuthorization(`Bearer ${SECRET}x`), SECRET),
    ).toBe("denied");
    expect(
      checkInternalJobAuth(withAuthorization("Bearer short"), SECRET),
    ).toBe("denied");
  });

  it("reports when no secret is configured, whatever the request sends", () => {
    expect(
      checkInternalJobAuth(withAuthorization(`Bearer ${SECRET}`), undefined),
    ).toBe("unconfigured");
    expect(checkInternalJobAuth(withAuthorization("Bearer "), "")).toBe(
      "unconfigured",
    );
  });
});
