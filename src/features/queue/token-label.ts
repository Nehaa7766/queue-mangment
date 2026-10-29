import { AppError } from "@/lib/errors/app-error";

const PREFIX_PATTERN = /^[A-Z]{1,3}$/;

export function isValidTokenPrefix(prefix: string): boolean {
  return PREFIX_PATTERN.test(prefix);
}

// Display label such as "A-17". Assumption until Phase 0 confirms: each
// service has its own prefix, numbers restart at 1 every queue day, no padding.
export function formatTokenLabel(
  prefix: string,
  sequenceNumber: number,
): string {
  if (!isValidTokenPrefix(prefix)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Token prefix must be 1 to 3 capital letters.",
    );
  }
  if (!Number.isInteger(sequenceNumber) || sequenceNumber < 1) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Token number must be a whole number of 1 or more.",
    );
  }
  return `${prefix}-${sequenceNumber}`;
}
