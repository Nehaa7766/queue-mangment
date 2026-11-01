import { MESSAGING_EVENT_NAME, type MessagingEvent } from "./contracts";

// Server-Sent Events framing for the messaging streams (docs/MESSAGING.md,
// "Live updates").

// A comment line every 25 seconds keeps proxies from closing an idle stream.
export const HEARTBEAT_MS = 25_000;
// Streams end after 5 minutes so EventSource reconnects and access and the
// session are checked again.
export const STREAM_LIFETIME_MS = 5 * 60_000;
// How long EventSource waits before reconnecting.
export const RECONNECT_DELAY_MS = 3_000;

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  // no-transform also stops the server's gzip, which would buffer the stream.
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no",
} as const;

export function formatSseEvent(event: MessagingEvent): string {
  return `event: ${MESSAGING_EVENT_NAME}\ndata: ${JSON.stringify(event)}\n\n`;
}

export function formatSseComment(text: string): string {
  return `: ${text.replace(/\n/g, " ")}\n\n`;
}

export function formatSseRetry(ms: number): string {
  return `retry: ${ms}\n\n`;
}
