import { AppError } from "@/lib/errors/app-error";

export function queueNotFound(): AppError {
  return new AppError("QUEUE_NOT_FOUND", "This queue could not be found.");
}

export function clinicNotFound(): AppError {
  return new AppError("CLINIC_NOT_FOUND", "This clinic could not be found.");
}

export function tokenNotFound(): AppError {
  return new AppError("TOKEN_NOT_FOUND", "This token could not be found.");
}

// Someone else changed the token between our read and our write.
export function tokenChanged(): AppError {
  return new AppError(
    "INVALID_STATE_TRANSITION",
    "This token was just updated by someone else. Refresh and try again.",
  );
}
