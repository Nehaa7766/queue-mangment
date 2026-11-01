import { afterEach, describe, expect, it, vi } from "vitest";
import {
  pendingStorageKey,
  pendingStore,
  type PendingMessage,
} from "@/components/messaging/pending-store";
import { PUBLIC_TOKEN } from "./fakes";

const entry = (overrides: Partial<PendingMessage> = {}): PendingMessage => ({
  clientMessageId: "11111111-1111-4111-8111-111111111111",
  body: "Running 10 minutes late",
  createdAt: new Date().toISOString(),
  status: "failed",
  failure: "network",
  ...overrides,
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("pendingStore", () => {
  it("never writes the patient's private token link into storage", () => {
    const scope = `patient:${PUBLIC_TOKEN}:RECEPTION`;
    pendingStore(scope).update(() => [entry()]);

    const key = pendingStorageKey(scope);
    expect(key).not.toContain(PUBLIC_TOKEN);
    expect(Object.keys(localStorage)).toEqual([key]);
    expect(localStorage.getItem(key)).not.toContain(PUBLIC_TOKEN);
  });

  it("keeps unsent messages for the next page load, per chat", () => {
    pendingStore("staff:u1:c1").update(() => [entry()]);

    // A new store reads what the last one wrote, as after a refresh.
    const reloaded = pendingStore("staff:u1:c1");
    expect(reloaded.get()).toHaveLength(1);
    expect(reloaded.get()[0].body).toBe("Running 10 minutes late");
    expect(pendingStore("staff:u2:c1").get()).toEqual([]);
  });

  it("removes the key when nothing is left to send", () => {
    const store = pendingStore("staff:u1:c2");
    store.update(() => [entry()]);
    store.update(() => []);

    expect(localStorage.length).toBe(0);
  });

  it("tells other screens for the same chat about changes", () => {
    const listener = vi.fn();
    pendingStore("staff:u1:c3").subscribe(listener);

    pendingStore("staff:u1:c3").update(() => [entry()]);

    expect(listener).toHaveBeenCalled();
  });

  it("ignores entries too old to send and unreadable data", () => {
    const scope = "staff:u1:c4";
    const old = entry({ createdAt: "2020-01-01T00:00:00.000Z" });
    localStorage.setItem(pendingStorageKey(scope), JSON.stringify([old]));
    expect(pendingStore(scope).get()).toEqual([]);

    localStorage.setItem(pendingStorageKey("staff:u1:c5"), "{not json");
    expect(pendingStore("staff:u1:c5").get()).toEqual([]);
  });

  it("still works for this visit when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const store = pendingStore("staff:u1:c6");

    store.update(() => [entry()]);

    expect(store.get()).toHaveLength(1);
  });
});
