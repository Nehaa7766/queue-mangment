import { describe, expect, it } from "vitest";
import {
  ACTION_TRANSITIONS,
  assertAction,
  assertTransition,
  canTransition,
  TOKEN_ACTIONS,
  TOKEN_STATUSES,
  type TokenAction,
  type TokenStatus,
} from "@/features/queue/token-status";
import { errorCodeOf } from "./helpers";

const ALLOWED: ReadonlyArray<[TokenStatus, TokenStatus]> = [
  ["WAITING", "CALLED"],
  ["WAITING", "CANCELLED"],
  ["CALLED", "IN_SERVICE"],
  ["CALLED", "SKIPPED"],
  ["SKIPPED", "WAITING"],
  ["IN_SERVICE", "COMPLETED"],
];

const isAllowed = (from: TokenStatus, to: TokenStatus) =>
  ALLOWED.some(([a, b]) => a === from && b === to);

const ALL_PAIRS = TOKEN_STATUSES.flatMap((from) =>
  TOKEN_STATUSES.map((to) => [from, to] as [TokenStatus, TokenStatus]),
);

describe("token transitions", () => {
  it.each(ALL_PAIRS)("%s → %s", (from, to) => {
    const allowed = isAllowed(from, to);
    expect(canTransition(from, to)).toBe(allowed);
    expect(errorCodeOf(() => assertTransition(from, to))).toBe(
      allowed ? null : "INVALID_STATE_TRANSITION",
    );
  });

  it("has no way out of COMPLETED or CANCELLED", () => {
    for (const to of TOKEN_STATUSES) {
      expect(canTransition("COMPLETED", to)).toBe(false);
      expect(canTransition("CANCELLED", to)).toBe(false);
    }
  });

  it("does not allow staying in the same status", () => {
    for (const status of TOKEN_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
  });
});

describe("token actions", () => {
  const allowRequeue = { allowRequeue: true };

  it("maps every action except recall onto an allowed transition", () => {
    for (const action of TOKEN_ACTIONS) {
      const { from, to } = ACTION_TRANSITIONS[action];
      if (action === "recall") {
        expect(from).toBe(to);
      } else {
        expect(isAllowed(from, to)).toBe(true);
      }
    }
  });

  const ACTION_CASES = TOKEN_ACTIONS.flatMap((action) =>
    TOKEN_STATUSES.map(
      (status) => [action, status] as [TokenAction, TokenStatus],
    ),
  );

  it.each(ACTION_CASES)("%s on a %s token", (action, status) => {
    const { from, to } = ACTION_TRANSITIONS[action];
    if (status === from) {
      expect(assertAction(action, status, allowRequeue)).toBe(to);
    } else {
      expect(
        errorCodeOf(() => assertAction(action, status, allowRequeue)),
      ).toBe("INVALID_STATE_TRANSITION");
    }
  });

  it("keeps a recalled token CALLED", () => {
    expect(assertAction("recall", "CALLED", allowRequeue)).toBe("CALLED");
  });

  it("cannot recall a token that was never called", () => {
    expect(
      errorCodeOf(() => assertAction("recall", "WAITING", allowRequeue)),
    ).toBe("INVALID_STATE_TRANSITION");
  });

  it("requeues a skipped token when the clinic allows it", () => {
    expect(assertAction("requeue", "SKIPPED", allowRequeue)).toBe("WAITING");
  });

  it("blocks requeue when the clinic does not allow it", () => {
    expect(
      errorCodeOf(() =>
        assertAction("requeue", "SKIPPED", { allowRequeue: false }),
      ),
    ).toBe("INVALID_STATE_TRANSITION");
  });

  it("lets a patient cancel only while waiting", () => {
    expect(assertAction("cancel", "WAITING", allowRequeue)).toBe("CANCELLED");
    expect(
      errorCodeOf(() => assertAction("cancel", "CALLED", allowRequeue)),
    ).toBe("INVALID_STATE_TRANSITION");
  });
});
