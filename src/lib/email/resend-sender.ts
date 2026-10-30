import { Resend } from "resend";
import type { EmailSender } from "./types";

// The slice of the Resend client we use, so tests can pass a stub.
export type ResendClient = Pick<Resend, "emails">;

export function createResendSender(options: {
  apiKey: string;
  from: string;
  client?: ResendClient;
}): EmailSender {
  const client = options.client ?? new Resend(options.apiKey);

  return {
    async send(message) {
      const { data, error } = await client.emails.send(
        {
          from: options.from,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
        },
        message.idempotencyKey
          ? { idempotencyKey: message.idempotencyKey }
          : undefined,
      );
      // The SDK returns errors instead of throwing them.
      if (error) {
        throw new Error(`Resend rejected the email: ${error.name}`);
      }
      return { id: data?.id ?? null };
    },
  };
}
