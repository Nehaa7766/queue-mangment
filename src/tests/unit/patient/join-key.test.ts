import { beforeEach, describe, expect, it } from "vitest";
import {
  clearJoinKey,
  getOrCreateJoinKey,
} from "@/components/patient/join-key";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("join key", () => {
  it("creates a UUID v4 and reuses it for the same queue", () => {
    const first = getOrCreateJoinKey("queue-1");

    expect(first).toMatch(UUID_V4);
    expect(getOrCreateJoinKey("queue-1")).toBe(first);
  });

  it("keeps separate keys per queue", () => {
    expect(getOrCreateJoinKey("queue-1")).not.toBe(
      getOrCreateJoinKey("queue-2"),
    );
  });

  it("starts a new attempt after the key is cleared", () => {
    const first = getOrCreateJoinKey("queue-1");
    clearJoinKey("queue-1");

    expect(getOrCreateJoinKey("queue-1")).not.toBe(first);
  });
});
