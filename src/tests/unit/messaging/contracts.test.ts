// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  MESSAGE_MAX_LENGTH,
  MESSAGING_API,
  channelFromSegment,
  createBroadcastBodySchema,
  messageBodySchema,
  normalizeMessageBody,
  sendMessageBodySchema,
} from "@/features/messaging/contracts";
import {
  decodeInboxCursor,
  encodeInboxCursor,
} from "@/features/messaging/inbox-cursor";
import { formatSseComment, formatSseEvent } from "@/features/messaging/sse";

describe("message text", () => {
  it("normalises line breaks, control characters and blank runs", () => {
    expect(normalizeMessageBody("  Hello\r\nthere\r  ")).toBe("Hello\nthere");
    expect(normalizeMessageBody("a\u0000b\u0007c\td")).toBe("abc\td");
    expect(normalizeMessageBody("one\n\n\n\n\ntwo")).toBe("one\n\ntwo");
  });

  it("needs some text and allows up to 1,000 characters", () => {
    expect(messageBodySchema.safeParse(" \n ").success).toBe(false);
    expect(
      messageBodySchema.safeParse("x".repeat(MESSAGE_MAX_LENGTH)).success,
    ).toBe(true);
    expect(
      messageBodySchema.safeParse("x".repeat(MESSAGE_MAX_LENGTH + 1)).success,
    ).toBe(false);
    // Measured after trimming.
    expect(
      messageBodySchema.safeParse(` ${"x".repeat(MESSAGE_MAX_LENGTH)} `)
        .success,
    ).toBe(true);
  });

  it("keeps the screens' wording for text problems", () => {
    const empty = messageBodySchema.safeParse("");
    const long = messageBodySchema.safeParse("x".repeat(1001));
    expect(empty.error?.issues[0].message).toBe("Write a message first.");
    expect(long.error?.issues[0].message).toBe(
      "Keep it under 1,000 characters.",
    );
  });

  it("needs a UUID clientMessageId and idempotency key", () => {
    const id = crypto.randomUUID();
    expect(
      sendMessageBodySchema.safeParse({ clientMessageId: id, body: "Hi" })
        .success,
    ).toBe(true);
    expect(
      sendMessageBodySchema.safeParse({ clientMessageId: "1", body: "Hi" })
        .success,
    ).toBe(false);
    expect(
      createBroadcastBodySchema.safeParse({
        idempotencyKey: id,
        body: "Hi",
        serviceIds: [],
      }).success,
    ).toBe(true);
    expect(
      createBroadcastBodySchema.safeParse({
        idempotencyKey: id,
        body: "Hi",
        serviceIds: ["x"],
      }).success,
    ).toBe(false);
  });
});

describe("paths", () => {
  it("builds the endpoint paths and reads channels back", () => {
    expect(MESSAGING_API.patientMessages("abc", "DOCTOR")).toBe(
      "/api/public/tokens/abc/messages/doctor",
    );
    expect(MESSAGING_API.startConversation("t", "RECEPTION")).toBe(
      "/api/messages/tokens/t/reception",
    );
    expect(channelFromSegment("doctor")).toBe("DOCTOR");
    expect(channelFromSegment("Reception")).toBe("RECEPTION");
    expect(channelFromSegment("billing")).toBeNull();
  });
});

describe("inbox cursor", () => {
  it("round-trips and rejects anything else", () => {
    const id = crypto.randomUUID();
    const cursor = { lastMessageAt: "2026-11-01T10:00:00.000Z", id };
    expect(decodeInboxCursor(encodeInboxCursor(cursor))).toEqual(cursor);
    expect(
      decodeInboxCursor(encodeInboxCursor({ lastMessageAt: null, id })),
    ).toEqual({
      lastMessageAt: null,
      id,
    });
    expect(decodeInboxCursor("not-a-cursor")).toBeNull();
    expect(
      decodeInboxCursor(Buffer.from('["x","y"]').toString("base64url")),
    ).toBeNull();
  });
});

describe("event-stream framing", () => {
  it("writes named events and single-line comments", () => {
    expect(formatSseEvent({ type: "broadcast", broadcastId: "b1" })).toBe(
      'event: messaging\ndata: {"type":"broadcast","broadcastId":"b1"}\n\n',
    );
    expect(formatSseComment("a\nb")).toBe(": a b\n\n");
  });
});
