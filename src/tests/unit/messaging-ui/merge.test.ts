import { describe, expect, it } from "vitest";
import {
  chatItems,
  deliveryStatus,
  mergeMessages,
  undelivered,
  withLatestPage,
  withOlderPage,
} from "@/components/messaging/merge";
import type { PendingMessage } from "@/components/messaging/pending-store";
import { message, page } from "./fakes";

function pending(overrides: Partial<PendingMessage> = {}): PendingMessage {
  return {
    clientMessageId: "pending-1",
    body: "On my way",
    createdAt: "2026-11-01T10:00:00.000Z",
    status: "sending",
    failure: null,
    ...overrides,
  };
}

describe("mergeMessages", () => {
  it("keeps one copy per id, oldest first, with the newest state", () => {
    const first = message({ createdAt: "2026-11-01T09:00:00.000Z" });
    const second = message({ createdAt: "2026-11-01T09:05:00.000Z" });
    const seenAgain = { ...first, seen: true };

    const merged = mergeMessages([second, first], [seenAgain]);

    expect(merged.map((m) => m.id)).toEqual([first.id, second.id]);
    expect(merged[0].seen).toBe(true);
  });

  it("treats a repeated clientMessageId as the same message", () => {
    const original = message({ clientMessageId: "same" });
    const stored = message({ clientMessageId: "same", body: original.body });

    const merged = mergeMessages([original], [stored]);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe(stored.id);
  });
});

describe("history pages", () => {
  it("adds a fresh newest page to older pages already loaded", () => {
    const older = [message(), message()];
    const shared = message();
    const history = { messages: [...older, shared], hasOlder: true };

    const next = withLatestPage(
      history,
      page([shared, message()], { hasOlder: true }),
    );

    expect(next.messages).toHaveLength(4);
    expect(next.hasOlder).toBe(true);
  });

  it("replaces the history when the new page doesn't reach back to it", () => {
    const history = { messages: [message(), message()], hasOlder: false };
    const fresh = [message(), message()];

    const next = withLatestPage(history, page(fresh, { hasOlder: true }));

    expect(next.messages.map((m) => m.id)).toEqual(fresh.map((m) => m.id));
    expect(next.hasOlder).toBe(true);
  });

  it("prepends older pages and takes their hasOlder", () => {
    const newest = message();
    const older = message({ createdAt: "2026-10-31T09:00:00.000Z" });

    const next = withOlderPage(
      { messages: [newest], hasOlder: true },
      page([older], { hasOlder: false }),
    );

    expect(next.messages.map((m) => m.id)).toEqual([older.id, newest.id]);
    expect(next.hasOlder).toBe(false);
  });
});

describe("pending messages", () => {
  it("drops pending entries the server already stored", () => {
    const stored = message({ clientMessageId: "pending-1" });

    expect(undelivered([pending()], [stored])).toEqual([]);
    expect(undelivered([pending()], [message()])).toHaveLength(1);
  });

  it("lists stored messages, then unsent ones, sides from the viewer", () => {
    const fromPatient = message({ sender: "PATIENT", senderName: null });
    const fromStaff = message({ sender: "STAFF", seen: true });

    const items = chatItems(
      [fromPatient, fromStaff],
      [pending({ status: "failed", failure: "network" })],
      "PATIENT",
    );

    expect(items.map((item) => item.mine)).toEqual([true, false, true]);
    expect(items.map(deliveryStatus)).toEqual(["sent", "seen", "failed"]);
    // A message keeps its row key when it goes from pending to stored.
    expect(items[2].key).toBe("c:pending-1");
  });

  it("hides a pending entry once its message is in the history", () => {
    const stored = message({ clientMessageId: "pending-1", sender: "PATIENT" });

    const items = chatItems([stored], [pending()], "PATIENT");

    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("message");
  });
});
