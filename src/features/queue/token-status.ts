import { AppError } from "@/lib/errors/app-error";

// Same names as the Prisma TokenStatus enum (Phase 2 schema).
export const TOKEN_STATUSES = [
  "WAITING",
  "CALLED",
  "IN_SERVICE",
  "COMPLETED",
  "SKIPPED",
  "CANCELLED",
] as const;

export type TokenStatus = (typeof TOKEN_STATUSES)[number];

// Labels from docs/PLAN.md §12.2, used in user-facing error messages.
const STATUS_LABELS: Record<TokenStatus, string> = {
  WAITING: "waiting",
  CALLED: "called",
  IN_SERVICE: "in consultation",
  COMPLETED: "done",
  SKIPPED: "skipped",
  CANCELLED: "cancelled",
};

// docs/PLAN.md §9. Assumption until Phase 0 confirms: nothing else is allowed.
const TRANSITIONS: Record<TokenStatus, readonly TokenStatus[]> = {
  WAITING: ["CALLED", "CANCELLED"],
  CALLED: ["IN_SERVICE", "SKIPPED"],
  IN_SERVICE: ["COMPLETED"],
  SKIPPED: ["WAITING"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: TokenStatus, to: TokenStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: TokenStatus, to: TokenStatus): void {
  if (!canTransition(from, to)) {
    throw new AppError(
      "INVALID_STATE_TRANSITION",
      `A ${STATUS_LABELS[from]} token cannot become ${STATUS_LABELS[to]}.`,
    );
  }
}

export const TOKEN_ACTIONS = [
  "call",
  "recall",
  "skip",
  "requeue",
  "cancel",
  "start",
  "complete",
] as const;

export type TokenAction = (typeof TOKEN_ACTIONS)[number];

// The status each staff or patient action requires, and the status it leads to.
export const ACTION_TRANSITIONS: Record<
  TokenAction,
  { from: TokenStatus; to: TokenStatus }
> = {
  call: { from: "WAITING", to: "CALLED" },
  // Recall announces the same token again: it stays CALLED and never creates a new token.
  recall: { from: "CALLED", to: "CALLED" },
  skip: { from: "CALLED", to: "SKIPPED" },
  requeue: { from: "SKIPPED", to: "WAITING" },
  // Assumption: patients may cancel their own token, but only while it is waiting.
  cancel: { from: "WAITING", to: "CANCELLED" },
  start: { from: "CALLED", to: "IN_SERVICE" },
  complete: { from: "IN_SERVICE", to: "COMPLETED" },
};

const ACTION_VERBS: Record<TokenAction, string> = {
  call: "call",
  recall: "recall",
  skip: "skip",
  requeue: "requeue",
  cancel: "cancel",
  start: "start a consultation for",
  complete: "complete a consultation for",
};

export type TokenPolicy = {
  // Whether skipped patients may rejoin the queue (clinic setting).
  allowRequeue: boolean;
};

// Checks that an action is allowed for a token and returns its new status.
export function assertAction(
  action: TokenAction,
  currentStatus: TokenStatus,
  policy: TokenPolicy,
): TokenStatus {
  const { from, to } = ACTION_TRANSITIONS[action];

  if (currentStatus !== from) {
    throw new AppError(
      "INVALID_STATE_TRANSITION",
      `You cannot ${ACTION_VERBS[action]} a ${STATUS_LABELS[currentStatus]} token.`,
    );
  }
  if (action === "requeue" && !policy.allowRequeue) {
    throw new AppError(
      "INVALID_STATE_TRANSITION",
      "This clinic does not allow skipped patients to rejoin the queue.",
    );
  }
  // Recall is the one action that keeps the status, so it is not in the table.
  if (action !== "recall") {
    assertTransition(from, to);
  }
  return to;
}
