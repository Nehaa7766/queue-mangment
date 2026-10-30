import type { EmailMessage, EmailSender } from "./types";

// Keep only the most recent messages so a long dev session can't grow memory.
const MAX_KEPT = 50;

const sent: EmailMessage[] = [];

// "priya@clinic.test" → "p***@clinic.test", for log lines.
export function redactEmail(address: string): string {
  const at = address.lastIndexOf("@");
  if (at <= 0) {
    return "***";
  }
  return `${address[0]}***${address.slice(at)}`;
}

// Development and tests: never delivers. Logs one redacted line (no links,
// which carry one-time tokens) and keeps the message for tests to inspect.
export function createMemorySender(
  log: (line: string) => void = console.info,
): EmailSender {
  return {
    async send(message) {
      sent.push(message);
      if (sent.length > MAX_KEPT) {
        sent.shift();
      }
      log(
        JSON.stringify({
          level: "info",
          message: "Email captured (not sent)",
          to: redactEmail(message.to),
          subject: message.subject,
        }),
      );
      return { id: null };
    },
  };
}

export function getSentEmails(): readonly EmailMessage[] {
  return sent;
}

export function clearSentEmails(): void {
  sent.length = 0;
}
