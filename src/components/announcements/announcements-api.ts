import {
  ApiError,
  apiRequest,
  newIdempotencyKey,
} from "@/components/queue/api-client";
import {
  MESSAGING_API,
  type BroadcastAudience,
  type BroadcastSummary,
  type CreateBroadcastBody,
} from "@/features/messaging/contracts";

// Browser-side calls for the announcement screens (docs/MESSAGING.md
// §Announcements). Errors arrive as ApiError with the server's code.

export { ApiError };

export function audienceUrl(serviceIds: readonly string[]): string {
  if (serviceIds.length === 0) return MESSAGING_API.broadcastAudience;
  const query = new URLSearchParams({ serviceIds: serviceIds.join(",") });
  return `${MESSAGING_API.broadcastAudience}?${query}`;
}

export function fetchAudience(
  serviceIds: readonly string[],
): Promise<BroadcastAudience> {
  return apiRequest<BroadcastAudience>(audienceUrl(serviceIds));
}

// 201 for a new announcement, 200 with the stored one when the same
// idempotency key comes again, so a retry never sends twice.
export function createBroadcast(
  body: CreateBroadcastBody,
): Promise<BroadcastSummary> {
  return apiRequest<BroadcastSummary>(MESSAGING_API.broadcasts, {
    method: "POST",
    body,
  });
}

// One key per composer session. crypto.randomUUID() only exists in secure
// contexts (HTTPS or localhost); elsewhere the queue helper builds a v4 UUID.
export function newAnnouncementKey(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : newIdempotencyKey();
}

export const SEND_ERRORS = {
  noRecipients:
    "No patients are waiting or called in these services right now, so there's no one to send it to.",
  rateLimited:
    "Too many announcements in a short time: the clinic can send 5 every 10 minutes. Wait a few minutes, then try again.",
  network:
    "Couldn't reach the server, so it may not have gone out. Try again: patients won't get it twice.",
  alreadySent:
    "An earlier try of this announcement already went out. Check the list before you send it again.",
  generic: "Something went wrong. Please try again.",
} as const;

// Errors after which sending the same announcement again makes sense.
export function isRetryable(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === "NETWORK_ERROR" ||
      error.code === "RATE_LIMITED" ||
      error.status >= 500)
  );
}
