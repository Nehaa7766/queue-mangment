import { getEnv, type Env } from "@/lib/env";
import { createMemorySender } from "./memory-sender";
import { createResendSender } from "./resend-sender";
import type { EmailSender } from "./types";

export type { EmailMessage, EmailSender } from "./types";

export type EmailSenderKind = "resend" | "memory" | "unconfigured";

// Resend only when a key is set. Production without one must not pretend to
// send, so it gets a sender that fails every message (and the outbox retries,
// then flags the event). Development and tests capture mail in memory.
export function selectEmailSenderKind(
  env: Pick<Env, "NODE_ENV" | "RESEND_API_KEY">,
): EmailSenderKind {
  if (env.RESEND_API_KEY) {
    return "resend";
  }
  return env.NODE_ENV === "production" ? "unconfigured" : "memory";
}

const unconfiguredSender: EmailSender = {
  async send() {
    throw new Error(
      "Email is not configured: set RESEND_API_KEY and EMAIL_FROM.",
    );
  },
};

let cachedSender: EmailSender | undefined;

// Chosen on first use, so `next build` never needs email settings.
export function getEmailSender(): EmailSender {
  if (!cachedSender) {
    const env = getEnv();
    const kind = selectEmailSenderKind(env);
    cachedSender =
      kind === "resend"
        ? createResendSender({
            apiKey: env.RESEND_API_KEY!,
            // env.ts requires EMAIL_FROM whenever RESEND_API_KEY is set.
            from: env.EMAIL_FROM!,
          })
        : kind === "memory"
          ? createMemorySender()
          : unconfiguredSender;
  }
  return cachedSender;
}
