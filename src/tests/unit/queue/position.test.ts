import { describe, expect, it } from "vitest";
import {
  peopleAhead,
  pickNextToken,
  type QueuedToken,
} from "@/features/queue/position";

const token = (
  id: string,
  sortKey: number,
  status: QueuedToken["status"] = "WAITING",
): QueuedToken => ({ id, sortKey, status });

describe("peopleAhead", () => {
  it("counts waiting tokens with a smaller sortKey", () => {
    const tokens = [token("a", 1), token("b", 2), token("c", 3)];
    expect(peopleAhead(tokens[2], tokens)).toBe(2);
  });

  it("is 0 for the first waiting token", () => {
    const tokens = [token("a", 1), token("b", 2)];
    expect(peopleAhead(tokens[0], tokens)).toBe(0);
  });

  it("ignores tokens that are no longer waiting", () => {
    const tokens = [
      token("a", 1, "COMPLETED"),
      token("b", 2, "CANCELLED"),
      token("c", 3, "IN_SERVICE"),
      token("d", 4, "CALLED"),
      token("e", 5, "SKIPPED"),
      token("f", 6),
      token("g", 7),
    ];
    expect(peopleAhead(tokens[6], tokens)).toBe(1);
  });

  it("returns null for a token that is not waiting", () => {
    const called = token("a", 1, "CALLED");
    expect(peopleAhead(called, [called, token("b", 2)])).toBeNull();
  });

  it("sends a requeued token to the back", () => {
    // Token "a" joined first, was skipped, then requeued with a fresh sortKey.
    const requeued = token("a", 6);
    const tokens = [requeued, token("b", 2), token("c", 3), token("d", 5)];
    expect(peopleAhead(requeued, tokens)).toBe(3);
  });

  it("works when the token itself is not in the list", () => {
    expect(peopleAhead(token("x", 10), [token("a", 1), token("b", 2)])).toBe(
      2,
    );
  });
});

describe("pickNextToken", () => {
  it("picks the waiting token with the smallest sortKey", () => {
    const tokens = [token("c", 3), token("a", 1, "CALLED"), token("b", 2)];
    expect(pickNextToken(tokens)?.id).toBe("b");
  });

  it("returns null when nobody is waiting", () => {
    expect(pickNextToken([token("a", 1, "COMPLETED")])).toBeNull();
    expect(pickNextToken([])).toBeNull();
  });

  it("calls a requeued token after everyone who was already waiting", () => {
    const tokens = [token("a", 6), token("b", 4)];
    expect(pickNextToken(tokens)?.id).toBe("b");
  });
});
