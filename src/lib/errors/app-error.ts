// Stable error codes from docs/PLAN.md §14, with the HTTP status each maps to.
export const ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  CLINIC_NOT_FOUND: 404,
  TOKEN_NOT_FOUND: 404,
  QUEUE_CLOSED: 409,
  QUEUE_PAUSED: 409,
  INVALID_STATE_TRANSITION: 409,
  IDEMPOTENCY_CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
} as const satisfies Record<string, number>;

export type ErrorCode = keyof typeof ERROR_STATUS;

// A known failure whose message is safe to show to the user.
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AppError";
    this.code = code;
    this.status = ERROR_STATUS[code];
  }
}
