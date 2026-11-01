"use client";

import { MessageCircleIcon, MessageSquareOffIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useChatSettings } from "./chat-context";
import type { LoadError } from "./conversation";

// Loading, empty and error states shared by the patient and staff chats.

export function ChatSkeleton({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      aria-busy="true"
      className={cn("flex flex-1 flex-col gap-3 px-4 py-4", className)}
    >
      <Skeleton className="h-12 w-3/5 rounded-2xl" />
      <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
      <Skeleton className="h-16 w-2/3 rounded-2xl" />
      <Skeleton className="ml-auto h-10 w-2/5 rounded-2xl" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ChatEmpty({
  title,
  body,
}: {
  title: string;
  body?: ReactNode;
}) {
  const { variant } = useChatSettings();
  return (
    <div className="flex h-full min-h-40 flex-1 flex-col items-center justify-center gap-2 px-4 py-6 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-brand-tint text-brand">
        <MessageCircleIcon aria-hidden className="size-5" />
      </span>
      <p className="font-semibold">{title}</p>
      {body && (
        <p
          className={cn(
            "max-w-xs text-muted-foreground",
            variant === "patient" ? "text-base" : "text-sm",
          )}
        >
          {body}
        </p>
      )}
    </div>
  );
}

export function ChatLoadError({
  error,
  onRetry,
}: {
  error: LoadError;
  onRetry: () => void;
}) {
  const { copy, variant } = useChatSettings();
  const text = error === "unavailable" ? copy.unavailable : copy.loadFailed;
  return (
    <div
      role="alert"
      className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center"
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-status-miss text-status-miss-foreground">
        <MessageSquareOffIcon aria-hidden className="size-5" />
      </span>
      <p className="font-semibold">{text.title}</p>
      <p
        className={cn(
          "max-w-xs text-muted-foreground",
          variant === "patient" ? "text-base" : "text-sm",
        )}
      >
        {text.body}
      </p>
      {error === "failed" && (
        <Button
          variant="outline"
          className="mt-1 h-10 rounded-btn px-4"
          onClick={onRetry}
        >
          {copy.loadFailed.retry}
        </Button>
      )}
    </div>
  );
}
