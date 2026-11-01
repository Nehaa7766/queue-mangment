import { vi } from "vitest";
import type {
  ConversationState,
  InboxItem,
  MessagePage,
  MessageView,
  PatientMessagingSummary,
} from "@/features/messaging/contracts";

// Test doubles for the chat screens: an EventSource the test drives, a
// fetch that answers by method and path, and message fixtures.

export class FakeEventSource {
  static instances: FakeEventSource[] = [];

  readonly url: string;
  readyState = 0;
  closed = false;
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  private readonly listeners = new Map<string, Set<(event: Event) => void>>();

  constructor(url: string | URL) {
    this.url = String(url);
    FakeEventSource.instances.push(this);
  }

  static latest(): FakeEventSource {
    const last = FakeEventSource.instances.at(-1);
    if (!last) throw new Error("No EventSource was opened.");
    return last;
  }

  static reset() {
    FakeEventSource.instances = [];
  }

  addEventListener(type: string, listener: (event: Event) => void) {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
  }

  removeEventListener(type: string, listener: (event: Event) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  close() {
    this.readyState = 2;
    this.closed = true;
  }

  // Test controls.
  open() {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }

  emit(data: unknown, type = "messaging") {
    const event = new MessageEvent(type, { data: JSON.stringify(data) });
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }

  fail() {
    this.onerror?.(new Event("error"));
  }
}

type Handler = (init: RequestInit | undefined, url: URL) => unknown;

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function apiError(
  status: number,
  code: string,
  message = "Nope.",
): Response {
  return json({ error: { code, message, requestId: "test" } }, status);
}

// fetch that answers "GET /path" and "POST /path" from a table. A handler
// may return a Response, a plain value (sent as JSON) or throw (a network
// error). Records every call.
export function mockApi(routes: Record<string, Handler>) {
  const calls: { method: string; url: URL; body: unknown }[] = [];
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://localhost");
      const method = init?.method ?? "GET";
      const body =
        typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      calls.push({ method, url, body });
      const handler = routes[`${method} ${url.pathname}`];
      if (!handler) throw new Error(`Unexpected ${method} ${url.pathname}`);
      const result = await handler(init, url);
      return result instanceof Response ? result : json(result);
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, calls };
}

export const PUBLIC_TOKEN = "8d3f6f0e-2c1b-4f7a-9a51-0b6f1d2e3c4b";
export const CONVERSATION_ID = "5b0f1f4e-3a2b-4c1d-8e9f-0a1b2c3d4e5f";

let sequence = 0;

export function message(overrides: Partial<MessageView> = {}): MessageView {
  sequence += 1;
  return {
    id: `m-${sequence}`,
    clientMessageId: `client-${sequence}`,
    sender: "STAFF",
    senderName: "Reception",
    body: `Message ${sequence}`,
    createdAt: new Date(Date.UTC(2026, 10, 1, 9, 0, sequence)).toISOString(),
    seen: false,
    isAnnouncement: false,
    ...overrides,
  };
}

export function conversation(
  overrides: Partial<ConversationState> = {},
): ConversationState {
  return {
    conversationId: CONVERSATION_ID,
    channel: "RECEPTION",
    closed: false,
    unread: 0,
    routing: null,
    ...overrides,
  };
}

export function page(
  messages: MessageView[],
  overrides: Partial<MessagePage> = {},
): MessagePage {
  return {
    conversation: conversation(),
    messages,
    hasOlder: false,
    ...overrides,
  };
}

export function summary(
  overrides: {
    reception?: Partial<ConversationState>;
    doctor?: Partial<ConversationState>;
  } = {},
): PatientMessagingSummary {
  return {
    reception: conversation({ ...overrides.reception }),
    doctor: conversation({
      conversationId: null,
      channel: "DOCTOR",
      routing: { kind: "SERVICE_DOCTORS", serviceName: "Pediatrics" },
      ...overrides.doctor,
    }),
  };
}

export function inboxItem(overrides: Partial<InboxItem> = {}): InboxItem {
  sequence += 1;
  return {
    conversationId: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    channel: "RECEPTION",
    token: {
      id: `token-${sequence}`,
      label: `A-${sequence}`,
      status: "WAITING",
      serviceName: "General",
      patientName: `Patient ${sequence}`,
      queueId: "queue-1",
    },
    lastMessage: {
      body: "When is my turn?",
      sender: "PATIENT",
      createdAt: "2026-11-01T09:00:00.000Z",
    },
    unread: 0,
    closed: false,
    routing: null,
    ...overrides,
  };
}

// navigator.onLine is read-only in jsdom; tests flip it with this.
export function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    get: () => online,
  });
}
