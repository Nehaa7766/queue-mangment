import {
  CHANNELS,
  MESSAGING_EVENT_NAME,
  type MessagingEvent,
} from "@/features/messaging/contracts";

// One Server-Sent Events connection to a messaging stream (docs/MESSAGING.md
// "Live updates"). Events are hints: listeners refetch through REST on every
// event and every (re)connect. Errors reconnect with exponential backoff and
// jitter; going online or back to the tab reconnects at once. A tab hidden
// for a while lets go of its connection, because browsers allow only six
// HTTP/1.1 connections per site across all tabs.

export type StreamStatus = "connecting" | "live" | "reconnecting" | "offline";

// `since` changes with every status change, so screens can wait a moment
// before showing a short reconnect.
export type StreamSnapshot = { status: StreamStatus; since: number };

export type StreamListener = {
  onEvent?: (event: MessagingEvent) => void;
  // Connected, the first time or again: anything may have been missed.
  onOpen?: () => void;
};

export type StreamSubscribe = (listener: StreamListener) => () => void;

const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;
export const HIDDEN_GRACE_MS = 30_000;

// Half the exponential step plus a random half ("equal jitter"), so many
// screens that lost the server together don't all come back at once.
export function backoffDelay(
  attempt: number,
  random: () => number = Math.random,
): number {
  const step = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt);
  return Math.round(step / 2 + random() * (step / 2));
}

const EVENT_TYPES = new Set(["message", "read", "conversation", "broadcast"]);

export function parseMessagingEvent(data: unknown): MessagingEvent | null {
  if (typeof data !== "string") return null;
  try {
    const value = JSON.parse(data) as Record<string, unknown>;
    if (!value || typeof value !== "object") return null;
    if (!EVENT_TYPES.has(value.type as string)) return null;
    if (value.type === "broadcast") {
      return typeof value.broadcastId === "string"
        ? (value as MessagingEvent)
        : null;
    }
    return typeof value.conversationId === "string" &&
      (CHANNELS as readonly unknown[]).includes(value.channel)
      ? (value as MessagingEvent)
      : null;
  } catch {
    return null;
  }
}

export class MessagingStream {
  private source: EventSource | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private hiddenTimer: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;
  private opened = false;
  private running = false;
  private snapshot: StreamSnapshot = { status: "connecting", since: 0 };
  private readonly listeners = new Set<StreamListener>();
  private readonly statusListeners = new Set<() => void>();

  constructor(private readonly url: string) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    window.addEventListener("online", this.handleOnline);
    window.addEventListener("offline", this.handleOffline);
    document.addEventListener("visibilitychange", this.handleVisibility);
    this.connect();
  }

  stop(): void {
    this.running = false;
    window.removeEventListener("online", this.handleOnline);
    window.removeEventListener("offline", this.handleOffline);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    this.disconnect();
    this.clearTimer("hiddenTimer");
  }

  subscribe: StreamSubscribe = (listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  subscribeStatus = (onChange: () => void): (() => void) => {
    this.statusListeners.add(onChange);
    return () => {
      this.statusListeners.delete(onChange);
    };
  };

  getSnapshot = (): StreamSnapshot => this.snapshot;

  private setStatus(status: StreamStatus) {
    if (this.snapshot.status === status) return;
    this.snapshot = { status, since: Date.now() };
    this.statusListeners.forEach((listener) => listener());
  }

  private clearTimer(name: "retryTimer" | "hiddenTimer") {
    const timer = this[name];
    if (timer !== null) clearTimeout(timer);
    this[name] = null;
  }

  private disconnect() {
    this.clearTimer("retryTimer");
    this.source?.close();
    this.source = null;
  }

  private connect() {
    this.disconnect();
    if (!this.running) return;
    if (!navigator.onLine) {
      this.setStatus("offline");
      return;
    }
    this.setStatus(this.opened ? "reconnecting" : "connecting");
    const source = new EventSource(this.url);
    this.source = source;
    source.onopen = () => {
      if (this.source !== source) return;
      this.attempt = 0;
      this.opened = true;
      this.setStatus("live");
      this.listeners.forEach((listener) => listener.onOpen?.());
    };
    source.addEventListener(MESSAGING_EVENT_NAME, (event) => {
      if (this.source !== source) return;
      const parsed = parseMessagingEvent((event as MessageEvent).data);
      if (parsed)
        this.listeners.forEach((listener) => listener.onEvent?.(parsed));
    });
    source.onerror = () => {
      if (this.source !== source) return;
      // Our own backoff instead of the browser's fixed retry, which also
      // gives up for good on an error status.
      source.close();
      this.source = null;
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (!this.running) return;
    if (!navigator.onLine) {
      this.setStatus("offline");
      return;
    }
    this.setStatus(this.opened ? "reconnecting" : "connecting");
    const delay = backoffDelay(this.attempt);
    this.attempt += 1;
    this.retryTimer = setTimeout(() => this.connect(), delay);
  }

  private reconnectNow() {
    if (!this.running || this.source) return;
    this.attempt = 0;
    this.connect();
  }

  private handleOnline = () => this.reconnectNow();

  private handleOffline = () => {
    this.disconnect();
    this.setStatus("offline");
  };

  private handleVisibility = () => {
    if (document.visibilityState === "visible") {
      this.clearTimer("hiddenTimer");
      this.reconnectNow();
      return;
    }
    if (this.hiddenTimer !== null) return;
    this.hiddenTimer = setTimeout(() => {
      this.hiddenTimer = null;
      if (document.visibilityState === "visible") return;
      this.disconnect();
      // Shown as a reconnect when the tab comes back.
      this.setStatus(this.opened ? "reconnecting" : "connecting");
    }, HIDDEN_GRACE_MS);
  };
}
