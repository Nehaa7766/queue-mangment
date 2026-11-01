import pg from "pg";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors/app-error";
import { logError } from "@/lib/log";
import type { MessagingEvent } from "./contracts";
import {
  MESSAGING_NOTIFY_CHANNEL,
  messagingNotificationSchema,
  type MessagingNotification,
} from "./rules";
import {
  HEARTBEAT_MS,
  RECONNECT_DELAY_MS,
  SSE_HEADERS,
  STREAM_LIFETIME_MS,
  formatSseComment,
  formatSseEvent,
  formatSseRetry,
} from "./sse";

// Live hints for the messaging screens (docs/MESSAGING.md, "Live updates").
//
// Each server process holds one extra PostgreSQL connection that runs
// LISTEN queuecare_messaging. Writers call pg_notify inside their
// transaction (notify.ts); this process fans each notification out to the
// open Server-Sent Events streams whose matcher accepts it. Hints carry ids
// only: screens refetch through REST, which checks access every time.
//
// The listener and the stream registry live on globalThis so a hot reload
// in development reuses them instead of leaking a connection per edit.

const MIN_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;
// How long a new stream waits for the listener before opening anyway.
const LISTEN_WAIT_MS = 5_000;
const LOG_ID = "messaging-listener";

type Subscriber = {
  // Listener generation this stream started under; -1 when it started
  // without a working listener.
  epoch: number;
  match: (notification: MessagingNotification) => MessagingEvent | null;
  send: (event: MessagingEvent) => void;
  close: () => void;
};

type Hub = {
  subscribers: Set<Subscriber>;
  // Open streams per cap key ("token:<id>", "staff:<userId>").
  openByKey: Map<string, number>;
  client: pg.Client | null;
  listening: boolean;
  connecting: Promise<void> | null;
  // Goes up on every successful LISTEN.
  epoch: number;
  retryDelayMs: number;
  retryTimer: ReturnType<typeof setTimeout> | null;
};

const globalForLive = globalThis as unknown as { messagingHub?: Hub };

function getHub(): Hub {
  globalForLive.messagingHub ??= {
    subscribers: new Set(),
    openByKey: new Map(),
    client: null,
    listening: false,
    connecting: null,
    epoch: 0,
    retryDelayMs: MIN_RETRY_MS,
    retryTimer: null,
  };
  return globalForLive.messagingHub;
}

// ---- Listener ----

function ensureListening(hub: Hub): Promise<void> {
  if (hub.listening) return Promise.resolve();
  hub.connecting ??= connect(hub).finally(() => {
    hub.connecting = null;
  });
  return hub.connecting;
}

async function connect(hub: Hub): Promise<void> {
  if (hub.retryTimer) {
    clearTimeout(hub.retryTimer);
    hub.retryTimer = null;
  }
  const client = new pg.Client({
    connectionString: getEnv().DATABASE_URL,
    keepAlive: true,
    application_name: "queuecare-messaging-listener",
  });
  client.on("notification", (message) => {
    if (message.channel === MESSAGING_NOTIFY_CHANNEL && message.payload) {
      dispatch(hub, message.payload);
    }
  });
  client.on("error", (error) => dropped(hub, client, error));
  client.on("end", () => dropped(hub, client));

  try {
    await client.connect();
    await client.query(`LISTEN ${MESSAGING_NOTIFY_CHANNEL}`);
  } catch (error) {
    discard(client);
    logError("Messaging listener could not connect", {
      requestId: LOG_ID,
      error,
    });
    scheduleReconnect(hub);
    throw error;
  }

  hub.client = client;
  hub.listening = true;
  hub.retryDelayMs = MIN_RETRY_MS;
  hub.epoch += 1;
  // Streams that started before this LISTEN may have missed hints (process
  // start, or a dropped connection). Ending them makes EventSource reconnect
  // and the screens refetch, so nothing stays missing.
  for (const subscriber of hub.subscribers) {
    if (subscriber.epoch !== hub.epoch) subscriber.close();
  }
}

function dropped(hub: Hub, client: pg.Client, error?: unknown): void {
  discard(client);
  if (hub.client !== client) return;
  hub.client = null;
  hub.listening = false;
  logError("Messaging listener disconnected", { requestId: LOG_ID, error });
  if (hub.subscribers.size > 0) scheduleReconnect(hub);
}

function discard(client: pg.Client): void {
  client.removeAllListeners();
  // A late socket error after end() must not crash the process.
  client.on("error", () => {});
  client.end().catch(() => {});
}

// Exponential backoff, 1 s up to 30 s, while any stream is open.
function scheduleReconnect(hub: Hub): void {
  if (hub.retryTimer) return;
  const delay = hub.retryDelayMs;
  hub.retryDelayMs = Math.min(MAX_RETRY_MS, delay * 2);
  hub.retryTimer = setTimeout(() => {
    hub.retryTimer = null;
    if (hub.subscribers.size > 0 && !hub.listening) {
      ensureListening(hub).catch(() => {});
    }
  }, delay);
  hub.retryTimer.unref?.();
}

function dispatch(hub: Hub, payload: string): void {
  let notification: MessagingNotification;
  try {
    const parsed = messagingNotificationSchema.safeParse(JSON.parse(payload));
    if (!parsed.success) return;
    notification = parsed.data;
  } catch {
    return;
  }
  for (const subscriber of hub.subscribers) {
    const event = subscriber.match(notification);
    if (event) subscriber.send(event);
  }
}

// ---- Streams ----

export type MessagingStreamOptions = {
  // Aborts when the client goes away.
  signal: AbortSignal;
  // Counts towards the cap, e.g. "token:<tokenId>" or "staff:<userId>".
  capKey: string;
  cap: number;
  // Returns the hint this viewer should get, or null.
  match: (notification: MessagingNotification) => MessagingEvent | null;
};

// An event-stream response. Throws RATE_LIMITED when the viewer already has
// `cap` streams open in this process.
export async function openMessagingStream(
  options: MessagingStreamOptions,
): Promise<Response> {
  const hub = getHub();
  const open = hub.openByKey.get(options.capKey) ?? 0;
  if (open >= options.cap) {
    throw new AppError(
      "RATE_LIMITED",
      "Too many open message windows. Close one and try again.",
    );
  }
  // Reserve the slot before waiting, so parallel opens can't pass the cap.
  hub.openByKey.set(options.capKey, open + 1);
  let reserved = true;
  const release = () => {
    if (!reserved) return;
    reserved = false;
    const count = (hub.openByKey.get(options.capKey) ?? 1) - 1;
    if (count > 0) hub.openByKey.set(options.capKey, count);
    else hub.openByKey.delete(options.capKey);
  };

  // Wait briefly for LISTEN, so hints after the stream opens are not missed.
  // If the database is unreachable the stream still opens; the reconnect
  // above ends it once the listener is back.
  await Promise.race([
    ensureListening(hub).catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, LISTEN_WAIT_MS).unref?.()),
  ]);

  const encoder = new TextEncoder();
  let finish: () => void = release;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const write = (text: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          finish();
        }
      };
      const subscriber: Subscriber = {
        epoch: hub.listening ? hub.epoch : -1,
        match: options.match,
        send: (event) => write(formatSseEvent(event)),
        close: () => finish(),
      };
      const heartbeat = setInterval(
        () => write(formatSseComment("keep-alive")),
        HEARTBEAT_MS,
      );
      const expiry = setTimeout(() => finish(), STREAM_LIFETIME_MS);
      finish = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        clearTimeout(expiry);
        options.signal.removeEventListener("abort", finish);
        hub.subscribers.delete(subscriber);
        release();
        try {
          controller.close();
        } catch {
          // Already closed or cancelled by the client.
        }
      };

      hub.subscribers.add(subscriber);
      // The first bytes flush the headers, so EventSource reports "open".
      write(formatSseRetry(RECONNECT_DELAY_MS) + formatSseComment("connected"));
      if (options.signal.aborted) finish();
      else options.signal.addEventListener("abort", finish, { once: true });
    },
    cancel() {
      finish();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

// For tests and diagnostics.
export function openStreamCount(capKey?: string): number {
  const hub = getHub();
  return capKey ? (hub.openByKey.get(capKey) ?? 0) : hub.subscribers.size;
}

// Ends every stream and the listener connection. Tests call this so the
// process can exit; nothing calls it in normal operation.
export async function stopMessagingListener(): Promise<void> {
  const hub = getHub();
  for (const subscriber of [...hub.subscribers]) subscriber.close();
  if (hub.retryTimer) {
    clearTimeout(hub.retryTimer);
    hub.retryTimer = null;
  }
  const client = hub.client;
  hub.client = null;
  hub.listening = false;
  if (client) {
    client.removeAllListeners();
    client.on("error", () => {});
    await client.end().catch(() => {});
  }
}
