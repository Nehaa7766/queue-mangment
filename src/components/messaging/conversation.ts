import {
  messageBodySchema,
  type ConversationState,
  type InboxItem,
} from "@/features/messaging/contracts";
import {
  ApiError,
  fetchMessagePage,
  newClientMessageId,
  postMessage,
  postRead,
} from "./api";
import {
  undelivered,
  withLatestPage,
  withMessage,
  withOlderPage,
  type History,
} from "./merge";
import {
  AUTO_RETRY_FAILURES,
  pendingStore,
  type PendingMessage,
  type PendingStore,
  type SendFailure,
} from "./pending-store";
import { Refresher } from "./refresher";

// One open chat: loads its history, sends with retries, marks it read
// (docs/MESSAGING.md "Sending a message"). Plain TypeScript, so the rules
// can be tested without a screen; useConversation() connects it to React.

// "unavailable": the chat is gone or no longer this viewer's (404/403).
export type LoadError = "unavailable" | "failed";

export type ConversationSnapshot = {
  // Null until the first page arrives.
  history: History | null;
  conversation: ConversationState | null;
  // Staff pages only (MessagePage.token).
  token: InboxItem["token"] | null;
  loadError: LoadError | null;
  loadingOlder: boolean;
  olderFailed: boolean;
  // Newest message when the chat first loaded; only later ones are
  // announced to screen readers.
  baselineId: string | null;
};

export type SendResult = { ok: true } | { ok: false; error: string };

export type ConversationConfig = {
  // GET pages and POST new messages.
  messagesUrl: string;
  readUrl: string;
  // Key for unsent messages; see pending-store.ts.
  scope: string;
};

export const INITIAL_SNAPSHOT: ConversationSnapshot = {
  history: null,
  conversation: null,
  token: null,
  loadError: null,
  loadingOlder: false,
  olderFailed: false,
  baselineId: null,
};

export function failureOf(error: unknown): SendFailure {
  if (!(error instanceof ApiError) || error.status === 0) return "network";
  if (error.code === "CONVERSATION_CLOSED") return "closed";
  if (error.status === 429) return "rate-limited";
  if ([401, 403, 404].includes(error.status)) return "forbidden";
  if (error.status >= 500) return "server";
  return "rejected";
}

function loadErrorOf(error: unknown): LoadError {
  return error instanceof ApiError && [401, 403, 404].includes(error.status)
    ? "unavailable"
    : "failed";
}

// Sends in progress anywhere on the page, so two screens for one chat never
// post the same message at the same time.
const inFlight = new Set<string>();

export class ConversationController {
  readonly pending: PendingStore;
  private snapshot: ConversationSnapshot = INITIAL_SNAPSHOT;
  private readonly listeners = new Set<() => void>();
  private readonly sentListeners = new Set<() => void>();
  private readonly refresher: Refresher;
  private running = false;
  private reading = false;

  constructor(private readonly config: ConversationConfig) {
    this.pending = pendingStore(config.scope);
    this.refresher = new Refresher(() => this.loadLatest());
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    window.addEventListener("online", this.handleOnline);
    void this.refresher.run();
  }

  stop(): void {
    this.running = false;
    window.removeEventListener("online", this.handleOnline);
    this.refresher.cancel();
  }

  subscribe = (onChange: () => void): (() => void) => {
    this.listeners.add(onChange);
    return () => {
      this.listeners.delete(onChange);
    };
  };

  getSnapshot = (): ConversationSnapshot => this.snapshot;

  // Called after each message this screen gets stored.
  onSent(listener: () => void): () => void {
    this.sentListeners.add(listener);
    return () => {
      this.sentListeners.delete(listener);
    };
  }

  // After a live event or a reconnect.
  scheduleRefresh = (): void => this.refresher.schedule();

  reload = (): void => {
    void this.refresher.run();
  };

  private set(patch: Partial<ConversationSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  private async loadLatest(): Promise<void> {
    try {
      const page = await fetchMessagePage(this.config.messagesUrl);
      const first = this.snapshot.history === null;
      this.set({
        history: withLatestPage(this.snapshot.history, page),
        conversation: page.conversation,
        token: page.token ?? null,
        loadError: null,
        baselineId: first
          ? (page.messages.at(-1)?.id ?? null)
          : this.snapshot.baselineId,
      });
      const pending = this.pending.get();
      if (undelivered(pending, page.messages).length !== pending.length) {
        this.pending.update((list) => undelivered(list, page.messages));
      }
      if (first) this.resumeUnsent();
    } catch (error) {
      this.set({ loadError: loadErrorOf(error) });
    }
  }

  // Messages left from an earlier visit to the page: send the ones that
  // were on their way or failed for lack of a connection.
  private resumeUnsent() {
    if (!navigator.onLine) return;
    for (const entry of this.pending.get()) {
      if (
        entry.status === "sending" ||
        (entry.failure && AUTO_RETRY_FAILURES.has(entry.failure))
      ) {
        void this.deliver(entry);
      }
    }
  }

  loadOlder = async (): Promise<void> => {
    const history = this.snapshot.history;
    const oldest = history?.messages[0];
    if (!history?.hasOlder || !oldest || this.snapshot.loadingOlder) return;
    this.set({ loadingOlder: true, olderFailed: false });
    try {
      const page = await fetchMessagePage(this.config.messagesUrl, oldest.id);
      this.set({
        history: withOlderPage(this.snapshot.history ?? history, page),
        loadingOlder: false,
      });
    } catch {
      this.set({ loadingOlder: false, olderFailed: true });
    }
  };

  send = (text: string): SendResult => {
    const parsed = messageBodySchema.safeParse(text);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Check the message.",
      };
    }
    const entry: PendingMessage = {
      clientMessageId: newClientMessageId(),
      body: parsed.data,
      createdAt: new Date().toISOString(),
      status: "sending",
      failure: null,
    };
    this.pending.update((list) => [...list, entry]);
    void this.deliver(entry);
    return { ok: true };
  };

  // Same id and text as the first try, so the server stores it once.
  retry = (clientMessageId: string): void => {
    const entry = this.pending
      .get()
      .find((item) => item.clientMessageId === clientMessageId);
    if (entry) void this.deliver(entry);
  };

  remove = (clientMessageId: string): void => {
    this.pending.update((list) =>
      list.filter((item) => item.clientMessageId !== clientMessageId),
    );
  };

  private setPendingStatus(
    clientMessageId: string,
    status: PendingMessage["status"],
    failure: SendFailure | null,
  ) {
    this.pending.update((list) =>
      list.map((item) =>
        item.clientMessageId === clientMessageId
          ? { ...item, status, failure }
          : item,
      ),
    );
  }

  private async deliver(entry: PendingMessage): Promise<void> {
    if (inFlight.has(entry.clientMessageId)) return;
    inFlight.add(entry.clientMessageId);
    if (entry.status !== "sending" || entry.failure !== null) {
      this.setPendingStatus(entry.clientMessageId, "sending", null);
    }
    try {
      const message = await postMessage(this.config.messagesUrl, {
        clientMessageId: entry.clientMessageId,
        body: entry.body,
      });
      this.set({ history: withMessage(this.snapshot.history, message) });
      this.pending.update((list) =>
        list.filter((item) => item.clientMessageId !== entry.clientMessageId),
      );
      // The first message creates the chat: fetch its id and state.
      if (!this.snapshot.conversation?.conversationId) this.scheduleRefresh();
      this.sentListeners.forEach((listener) => listener());
    } catch (error) {
      const failure = failureOf(error);
      this.setPendingStatus(entry.clientMessageId, "failed", failure);
      // Closed or no longer ours: show the chat's current state.
      if (failure === "closed" || failure === "forbidden") {
        this.scheduleRefresh();
      }
    } finally {
      inFlight.delete(entry.clientMessageId);
    }
  }

  // Resets this side's unread count; the other side sees "Seen".
  async markRead(): Promise<boolean> {
    if (this.reading) return false;
    this.reading = true;
    try {
      await postRead(this.config.readUrl);
      const conversation = this.snapshot.conversation;
      if (conversation)
        this.set({ conversation: { ...conversation, unread: 0 } });
      return true;
    } catch {
      return false;
    } finally {
      this.reading = false;
    }
  }

  private handleOnline = () => {
    for (const entry of this.pending.get()) {
      if (entry.failure && AUTO_RETRY_FAILURES.has(entry.failure)) {
        void this.deliver(entry);
      }
    }
    this.reload();
  };
}
