export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  // The provider drops a repeat with the same key, so a retry after a crash
  // never delivers twice.
  idempotencyKey?: string;
};

export type EmailSender = {
  // Throws when the message could not be handed to the provider.
  send(message: EmailMessage): Promise<{ id: string | null }>;
};
