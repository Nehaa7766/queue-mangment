import { z } from "zod";
import {
  CLOSE_AFTER_JOIN_MS,
  MESSAGE_MAX_LENGTH,
} from "@/features/messaging/contracts";

// Messages the screen has not yet seen stored, kept in localStorage so a
// refresh or a dropped connection doesn't lose them (docs/MESSAGING.md
// decision 13). Only the text the user typed is stored, never a credential:
// keys hash the scope, because a patient's scope contains their private
// token link.

// Why a message wasn't stored. "network" and "server" retry by themselves
// when the browser comes back online; the others wait for the user.
export type SendFailure =
  "network" | "server" | "closed" | "rate-limited" | "forbidden" | "rejected";

export type PendingMessage = {
  clientMessageId: string;
  body: string;
  createdAt: string;
  status: "sending" | "failed";
  failure: SendFailure | null;
};

export const AUTO_RETRY_FAILURES: ReadonlySet<SendFailure> = new Set([
  "network",
  "server",
]);

const KEY_PREFIX = "queuecare.chat-pending.v1.";
// More than this in one chat means something is badly wrong; keep the newest.
const MAX_PER_SCOPE = 20;

const pendingSchema = z.array(
  z.object({
    clientMessageId: z.string().min(1).max(100),
    body: z.string().max(MESSAGE_MAX_LENGTH),
    createdAt: z.string(),
    status: z.enum(["sending", "failed"]),
    failure: z
      .enum([
        "network",
        "server",
        "closed",
        "rate-limited",
        "forbidden",
        "rejected",
      ])
      .nullable(),
  }),
);

// cyrb53: a small, fast, non-cryptographic string hash. Enough to keep
// scopes apart without writing the scope itself.
function hashScope(scope: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < scope.length; i++) {
    const ch = scope.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export function pendingStorageKey(scope: string): string {
  return KEY_PREFIX + hashScope(scope);
}

// Used when storage is blocked (private mode, strict settings), so retries
// still work for this visit.
const memory = new Map<string, PendingMessage[]>();
const listeners = new Map<string, Set<() => void>>();
const EMPTY: PendingMessage[] = [];
const BLOCKED = Symbol("blocked");

function rawItem(key: string): string | null | typeof BLOCKED {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return BLOCKED;
  }
}

function parse(raw: string | null): PendingMessage[] {
  if (raw === null) return EMPTY;
  try {
    const parsed = pendingSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return EMPTY;
    // Chats close a day after joining at the latest, so older entries can
    // never be sent.
    const cutoff = Date.now() - CLOSE_AFTER_JOIN_MS;
    return parsed.data.filter((entry) => Date.parse(entry.createdAt) > cutoff);
  } catch {
    return EMPTY;
  }
}

function write(key: string, list: PendingMessage[]): void {
  try {
    if (list.length === 0) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(list));
    memory.delete(key);
  } catch {
    memory.set(key, list);
  }
}

// One store per chat. Several screens for the same chat (or a second tab)
// see each other's changes.
export type PendingStore = {
  get: () => PendingMessage[];
  update: (change: (list: PendingMessage[]) => PendingMessage[]) => void;
  subscribe: (onChange: () => void) => () => void;
};

// Parsed lists by key, reused while the stored text is unchanged: the same
// array until something changes, as useSyncExternalStore needs.
const cache = new Map<
  string,
  { raw: string | null | typeof BLOCKED; value: PendingMessage[] }
>();

function read(key: string): PendingMessage[] {
  // The last write failed (blocked or full storage): memory has the truth.
  const remembered = memory.get(key);
  if (remembered) return remembered;
  const raw = rawItem(key);
  if (raw === BLOCKED) return EMPTY;
  const cached = cache.get(key);
  if (cached && cached.raw === raw) return cached.value;
  const value = parse(raw);
  cache.set(key, { raw, value });
  return value;
}

function notify(key: string) {
  listeners.get(key)?.forEach((listener) => listener());
}

let storageListening = false;
function listenToOtherTabs() {
  if (storageListening || typeof window === "undefined") return;
  storageListening = true;
  window.addEventListener("storage", (event) => {
    if (event.key?.startsWith(KEY_PREFIX)) notify(event.key);
  });
}

export function pendingStore(scope: string): PendingStore {
  const key = pendingStorageKey(scope);
  return {
    get: () => read(key),
    update(change) {
      // Read-modify-write on the stored list, so an older screen finishing
      // a send can't overwrite a newer one's changes.
      write(key, change(read(key)).slice(-MAX_PER_SCOPE));
      notify(key);
    },
    subscribe(onChange) {
      listenToOtherTabs();
      let set = listeners.get(key);
      if (!set) {
        set = new Set();
        listeners.set(key, set);
      }
      set.add(onChange);
      return () => {
        set.delete(onChange);
      };
    },
  };
}

// For the server render, where there is no storage.
export function emptyPending(): PendingMessage[] {
  return EMPTY;
}
