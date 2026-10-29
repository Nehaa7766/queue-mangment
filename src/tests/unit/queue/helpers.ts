import { AppError, type ErrorCode } from "@/lib/errors/app-error";

// Runs fn and returns the AppError code it threw, or null if it did not throw.
export function errorCodeOf(fn: () => unknown): ErrorCode | null {
  try {
    fn();
  } catch (error) {
    if (error instanceof AppError) {
      return error.code;
    }
    throw error;
  }
  return null;
}
