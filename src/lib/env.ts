import { z } from "zod";

// "addr@domain" or "Name <addr@domain>".
const EMAIL_FROM_PATTERN =
  /^(?:[^<>]+<[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>|[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+)$/;

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    // Signs session cookies. Generate with: openssl rand -base64 32
    BETTER_AUTH_SECRET: z.string().min(32),
    // Public URL of the app, used for auth callbacks and trusted origins.
    BETTER_AUTH_URL: z.url({ protocol: /^https?$/ }),
    // Bearer token for /api/internal/* job endpoints (outbox worker, data
    // retention). When unset, those endpoints refuse every request.
    INTERNAL_JOB_SECRET: z.string().min(32).optional(),
    // Header the reverse proxy overwrites with the client address, e.g.
    // "x-forwarded-for". Leave unset without a proxy: clients can forge it.
    TRUSTED_IP_HEADER: z.string().trim().toLowerCase().min(1).optional(),
    // Show the demo accounts on the sign-in page in a production build too,
    // for a demo server. Development always shows them; real sites leave
    // this unset (the seed refuses to create them in other databases anyway).
    DEMO_LOGINS: z.stringbool().optional(),
    // Email. Without RESEND_API_KEY, development and tests use an in-memory
    // sender and production refuses to send (src/lib/email).
    RESEND_API_KEY: z.string().min(1).optional(),
    // Sender on a domain verified with Resend, e.g. "QueueCare <notifications@example.com>".
    EMAIL_FROM: z
      .string()
      .trim()
      .regex(EMAIL_FROM_PATTERN, "Use addr@domain or Name <addr@domain>.")
      .optional(),
  })
  .superRefine((env, ctx) => {
    if (env.RESEND_API_KEY && !env.EMAIL_FROM) {
      ctx.addIssue({
        code: "custom",
        path: ["EMAIL_FROM"],
        message: "Required when RESEND_API_KEY is set.",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}

let cachedEnv: Env | undefined;

// Read lazily so `next build` can run without runtime secrets,
// for example in the Docker builder stage.
export function getEnv(): Env {
  cachedEnv ??= parseEnv(process.env);
  return cachedEnv;
}
