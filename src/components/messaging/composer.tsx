"use client";

import { LockIcon, SendHorizontalIcon } from "lucide-react";
import {
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  MESSAGE_MAX_LENGTH,
  normalizeMessageBody,
} from "@/features/messaging/contracts";
import { cn } from "@/lib/utils";
import { useChatSettings } from "./chat-context";
import type { SendResult } from "./conversation";

// Text box and Send button under a chat. With a keyboard, Enter sends and
// Shift+Enter starts a new line; on touch screens Enter adds a line and the
// button sends. Closed chats keep it visible but disabled, with the reason.
export function Composer({
  onSend,
  closedNote,
}: {
  onSend: (text: string) => SendResult;
  // Set when the chat is read-only: why, in a sentence.
  closedNote?: ReactNode;
}) {
  const { copy, variant } = useChatSettings();
  const id = useId();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const length = normalizeMessageBody(text).length;
  const tooLong = length > MESSAGE_MAX_LENGTH;
  const closed = closedNote !== undefined && closedNote !== null;
  const canSend = !closed && length > 0 && !tooLong;
  const shownError = tooLong ? copy.composer.tooLong : error;

  function submit() {
    if (!canSend) return;
    const result = onSend(text);
    if (result.ok) {
      setText("");
      setError(null);
    } else {
      setError(result.error);
    }
    textareaRef.current?.focus();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    // Enter that confirms an input method (Hindi, Marathi…) isn't a send.
    if (event.nativeEvent.isComposing) return;
    if (window.matchMedia?.("(pointer: coarse)").matches) return;
    event.preventDefault();
    submit();
  }

  // When the phone keyboard opens, scroll so the box stays above it.
  function keepAboveKeyboard() {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const reveal = () => formRef.current?.scrollIntoView({ block: "nearest" });
    viewport.addEventListener("resize", reveal, { once: true });
    window.setTimeout(
      () => viewport.removeEventListener("resize", reveal),
      1500,
    );
  }

  return (
    <form
      ref={formRef}
      method="post"
      onSubmit={handleSubmit}
      className="flex flex-col gap-1.5 border-t border-divider bg-card p-3"
    >
      {closed && (
        <p
          id={`${id}-closed`}
          className="flex items-start gap-2 rounded-btn bg-status-off px-3 py-2 text-sm text-status-off-foreground"
        >
          <LockIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{closedNote}</span>
        </p>
      )}
      <div className="flex items-end gap-2">
        <label htmlFor={`${id}-text`} className="sr-only">
          {closed ? copy.composer.closedLabel : copy.composer.label}
        </label>
        <Textarea
          ref={textareaRef}
          id={`${id}-text`}
          name="body"
          rows={1}
          value={text}
          disabled={closed}
          placeholder={copy.composer.placeholder}
          aria-invalid={tooLong || undefined}
          aria-describedby={[
            closed && `${id}-closed`,
            `${id}-count`,
            shownError && `${id}-error`,
          ]
            .filter(Boolean)
            .join(" ")}
          onChange={(event) => {
            setText(event.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          onFocus={keepAboveKeyboard}
          className={cn(
            "max-h-40 min-h-11 resize-none rounded-btn bg-card py-2.5",
            variant === "patient" && "md:text-base",
          )}
        />
        <Button
          type="submit"
          disabled={!canSend}
          className="size-11 shrink-0 rounded-btn"
        >
          <SendHorizontalIcon aria-hidden className="size-5" />
          <span className="sr-only">{copy.composer.send}</span>
        </Button>
      </div>
      <div className="flex items-start justify-between gap-3 text-xs">
        {shownError ? (
          <p
            id={`${id}-error`}
            role="alert"
            className="font-medium text-destructive"
          >
            {shownError}
          </p>
        ) : (
          <span className="hidden text-muted-foreground [@media(pointer:fine)]:inline">
            {closed ? null : copy.composer.hint}
          </span>
        )}
        <span
          id={`${id}-count`}
          className={cn(
            "ml-auto shrink-0 tabular-nums",
            tooLong
              ? "font-semibold text-destructive"
              : "text-muted-foreground",
          )}
        >
          {copy.composer.counter(length)}
        </span>
      </div>
    </form>
  );
}
