import { z } from "zod";
import { getDb } from "@/lib/db";
import { getEmailSender, type EmailSender } from "@/lib/email";
import type { OutboxEventType, OutboxPayloads } from "./events";
import {
  renderPasswordResetEmail,
  renderStaffInvitationEmail,
  type RenderedEmail,
} from "./templates";

// After this many failed attempts the event is flagged with failedAt and
// left for a person to look at.
export const MAX_ATTEMPTS = 8;

const BASE_DELAY_MS = 60_000;
const MAX_DELAY_MS = 60 * 60_000;

// While a worker holds an event, other workers treat it as not due. If the
// worker dies mid-send, the event becomes due again after this long.
const LEASE_MS = 5 * 60_000;

const DEFAULT_BATCH_SIZE = 20;

// Wait before the next try, after `attempts` failures:
// 1 min, 2, 4, 8, 16, 32, then 60 min.
export function backoffDelayMs(attempts: number): number {
  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1));
}

// lastError is stored and shown to admins: no links (they carry one-time
// tokens), no email addresses, and short.
export function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/https?:\/\/\S+/g, "[link]")
    .replace(/[^\s@<>"']+@[^\s@<>"']+/g, "[email]")
    .slice(0, 300);
}

const isoDate = z.iso.datetime({ offset: true });

const PAYLOAD_SCHEMAS = {
  "staff.invited": z.object({
    invitationId: z.string(),
    email: z.email(),
    name: z.string().min(1),
    clinicName: z.string().min(1),
    role: z.enum(["RECEPTIONIST", "DOCTOR", "CLINIC_ADMIN"]),
    acceptUrl: z.url(),
    expiresAt: isoDate,
  }),
  "auth.password-reset-requested": z.object({
    userId: z.string(),
    email: z.email(),
    name: z.string().min(1),
    resetUrl: z.url(),
    expiresAt: isoDate,
  }),
} satisfies { [T in OutboxEventType]: z.ZodType<OutboxPayloads[T]> };

// The one-time link in each payload, removed once the email is delivered.
const LINK_FIELDS = {
  "staff.invited": "acceptUrl",
  "auth.password-reset-requested": "resetUrl",
} as const satisfies { [T in OutboxEventType]: keyof OutboxPayloads[T] };

function isEventType(value: string): value is OutboxEventType {
  return Object.hasOwn(PAYLOAD_SCHEMAS, value);
}

export function stripOneTimeLink(
  eventType: OutboxEventType,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const { [LINK_FIELDS[eventType]]: _removed, ...rest } = payload;
  void _removed;
  return rest;
}

type Prepared =
  | { kind: "send"; to: string; email: RenderedEmail }
  // Not worth retrying: the event can never be sent as it is.
  | { kind: "give-up"; reason: string };

function prepareEmail(
  eventType: string,
  rawPayload: unknown,
  now: Date,
): Prepared {
  if (!isEventType(eventType)) {
    return { kind: "give-up", reason: `Unknown event type "${eventType}".` };
  }
  const parsed = PAYLOAD_SCHEMAS[eventType].safeParse(rawPayload);
  if (!parsed.success) {
    return { kind: "give-up", reason: "The event payload is invalid." };
  }
  // A link that expired while we were retrying would only confuse people.
  if (new Date(parsed.data.expiresAt).getTime() <= now.getTime()) {
    return {
      kind: "give-up",
      reason: "The link expired before the email could be sent.",
    };
  }

  const email =
    eventType === "staff.invited"
      ? renderStaffInvitationEmail(
          parsed.data as OutboxPayloads["staff.invited"],
          now,
        )
      : renderPasswordResetEmail(
          parsed.data as OutboxPayloads["auth.password-reset-requested"],
          now,
        );
  return { kind: "send", to: parsed.data.email, email };
}

type ClaimedEvent = {
  id: string;
  event_type: string;
  payload: unknown;
  attempt_count: number;
};

export type OutboxBatchResult = {
  claimed: number;
  sent: number;
  retrying: number;
  failed: number;
};

// Claims due events, sends them and records the outcome. Safe to run from
// several workers at once: each event is claimed by exactly one of them.
export async function processOutboxBatch(
  options: { sender?: EmailSender; now?: Date; limit?: number } = {},
): Promise<OutboxBatchResult> {
  const sender = options.sender ?? getEmailSender();
  const now = options.now ?? new Date();
  const limit = options.limit ?? DEFAULT_BATCH_SIZE;
  const leaseUntil = new Date(now.getTime() + LEASE_MS);
  const db = getDb();

  // Columns are UTC timestamps without a time zone, like Prisma writes them.
  // SKIP LOCKED lets concurrent workers pass over rows another one is claiming;
  // pushing next_attempt_at forward keeps them away until this one finishes.
  const claimed = await db.$queryRaw<ClaimedEvent[]>`
    WITH due AS (
      SELECT id FROM outbox_events
      WHERE processed_at IS NULL
        AND failed_at IS NULL
        AND next_attempt_at <= (${now.toISOString()}::timestamptz AT TIME ZONE 'UTC')
      ORDER BY next_attempt_at, created_at
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE outbox_events AS o
    SET next_attempt_at = (${leaseUntil.toISOString()}::timestamptz AT TIME ZONE 'UTC'),
        attempt_count = o.attempt_count + 1
    FROM due
    WHERE o.id = due.id
    RETURNING o.id, o.event_type, o.payload, o.attempt_count`;

  const result: OutboxBatchResult = {
    claimed: claimed.length,
    sent: 0,
    retrying: 0,
    failed: 0,
  };

  for (const event of claimed) {
    const prepared = prepareEmail(event.event_type, event.payload, now);
    if (prepared.kind === "give-up") {
      await db.outboxEvent.update({
        where: { id: event.id },
        data: { failedAt: now, lastError: prepared.reason },
      });
      result.failed += 1;
      continue;
    }

    try {
      await sender.send({
        to: prepared.to,
        ...prepared.email,
        idempotencyKey: `outbox-${event.id}`,
      });
    } catch (error) {
      const outOfAttempts = event.attempt_count >= MAX_ATTEMPTS;
      await db.outboxEvent.update({
        where: { id: event.id },
        data: {
          lastError: sanitizeError(error),
          ...(outOfAttempts
            ? { failedAt: now }
            : {
                nextAttemptAt: new Date(
                  now.getTime() + backoffDelayMs(event.attempt_count),
                ),
              }),
        },
      });
      result[outOfAttempts ? "failed" : "retrying"] += 1;
      continue;
    }

    await db.outboxEvent.update({
      where: { id: event.id },
      data: {
        processedAt: now,
        lastError: null,
        payload: stripOneTimeLink(
          event.event_type as OutboxEventType,
          event.payload as Record<string, unknown>,
        ) as object,
      },
    });
    result.sent += 1;
  }

  return result;
}
