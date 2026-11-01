import { AppError } from "@/lib/errors/app-error";

// Also used for chats in another clinic and chats the caller may not see,
// so a probe can't tell them apart from ids that don't exist.
export function conversationNotFound(): AppError {
  return new AppError(
    "CONVERSATION_NOT_FOUND",
    "This conversation could not be found.",
  );
}

export function conversationClosed(): AppError {
  return new AppError(
    "CONVERSATION_CLOSED",
    "This chat is closed. Please speak to the clinic in person.",
  );
}

export function announcementNotFound(): AppError {
  return new AppError(
    "ANNOUNCEMENT_NOT_FOUND",
    "This announcement could not be found.",
  );
}
