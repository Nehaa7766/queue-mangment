import { describe, expect, it } from "vitest";
import {
  formatTokenLabel,
  isValidTokenPrefix,
} from "@/features/queue/token-label";
import { errorCodeOf } from "./helpers";

describe("formatTokenLabel", () => {
  it("joins prefix and number", () => {
    expect(formatTokenLabel("A", 17)).toBe("A-17");
    expect(formatTokenLabel("PED", 1)).toBe("PED-1");
  });

  it.each(["", "a", "AB1", "ABCD", "A-", " A"])(
    "rejects the prefix %j",
    (prefix) => {
      expect(isValidTokenPrefix(prefix)).toBe(false);
      expect(errorCodeOf(() => formatTokenLabel(prefix, 1))).toBe(
        "VALIDATION_ERROR",
      );
    },
  );

  it.each([0, -1, 1.5, Number.NaN])("rejects the number %s", (number) => {
    expect(errorCodeOf(() => formatTokenLabel("A", number))).toBe(
      "VALIDATION_ERROR",
    );
  });
});
