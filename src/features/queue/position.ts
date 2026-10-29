import type { TokenStatus } from "./token-status";

// The fields queue ordering needs. sortKey equals sequenceNumber at join;
// a requeue gives the token a fresh, larger sortKey, sending it to the back.
export type QueuedToken = {
  id: string;
  status: TokenStatus;
  sortKey: number;
};

// Number of waiting patients ahead of this token, or null if it is no longer waiting.
// Tokens in any other status never count (docs/PLAN.md §9, rule 14).
export function peopleAhead(
  token: QueuedToken,
  tokens: readonly QueuedToken[],
): number | null {
  if (token.status !== "WAITING") {
    return null;
  }
  return tokens.filter(
    (other) =>
      other.status === "WAITING" &&
      other.id !== token.id &&
      other.sortKey < token.sortKey,
  ).length;
}

// FIFO only in v1 (no priority tokens): the waiting token with the smallest sortKey.
export function pickNextToken<T extends QueuedToken>(
  tokens: readonly T[],
): T | null {
  let next: T | null = null;
  for (const token of tokens) {
    if (token.status === "WAITING" && (!next || token.sortKey < next.sortKey)) {
      next = token;
    }
  }
  return next;
}
