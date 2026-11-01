import type { z } from "zod";
import { readJsonBody } from "@/features/queue/http";
import { AppError } from "@/lib/errors/app-error";
import { channelFromSegment, type Channel } from "./contracts";
import { conversationNotFound } from "./errors";

// Small helpers shared by the messaging route handlers.

// An unknown channel in the path is a chat that doesn't exist.
export function readChannel(segment: string): Channel {
  const channel = channelFromSegment(segment);
  if (!channel) throw conversationNotFound();
  return channel;
}

// Parses a JSON body. Problems with the message text keep their own wording
// ("Write a message first.") so screens can show it as is.
export async function readMessagingBody<Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
): Promise<z.output<Schema>> {
  const parsed = schema.safeParse(await readJsonBody(request));
  if (parsed.success) return parsed.data;
  const textIssue = parsed.error.issues.find(
    (issue) => issue.path[0] === "body",
  );
  throw new AppError(
    "VALIDATION_ERROR",
    textIssue?.message ?? "Some fields are missing or invalid.",
  );
}
