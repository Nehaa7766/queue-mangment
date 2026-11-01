import { z } from "zod";

// The inbox is ordered by last message (newest first, chats without messages
// last), then id. The cursor is the last item's position, opaque to screens.
export type InboxCursor = { lastMessageAt: string | null; id: string };

const cursorSchema = z.tuple([z.iso.datetime().nullable(), z.uuid()]);

export function encodeInboxCursor(cursor: InboxCursor): string {
  return Buffer.from(
    JSON.stringify([cursor.lastMessageAt, cursor.id]),
  ).toString("base64url");
}

// Null for anything that isn't a cursor this server made.
export function decodeInboxCursor(value: string): InboxCursor | null {
  try {
    const parsed = cursorSchema.safeParse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
    return parsed.success
      ? { lastMessageAt: parsed.data[0], id: parsed.data[1] }
      : null;
  } catch {
    return null;
  }
}
