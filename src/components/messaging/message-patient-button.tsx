"use client";

import { MessageSquareIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ApiError, startConversation } from "./api";

// Opens (or starts) the reception chat with a token's patient and goes to
// it on the Messages page.
export function MessagePatientButton({
  tokenId,
  tokenLabel,
  patientName,
  messagesHref,
  compact = false,
  className,
}: {
  tokenId: string;
  tokenLabel: string;
  patientName: string;
  // The panel's Messages page, e.g. /receptionist/messages.
  messagesHref: string;
  // Icon only below sm, for list rows on phones.
  compact?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    try {
      const { conversationId } = await startConversation(tokenId, "RECEPTION");
      router.push(`${messagesHref}?c=${conversationId}`);
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Couldn't open the chat. Please try again.",
      );
      setBusy(false);
    }
  }

  return (
    <Button
      variant="outline"
      disabled={busy}
      onClick={() => void open()}
      className={cn(
        "h-10 rounded-btn",
        compact ? "w-10 px-0 sm:w-auto sm:px-3" : "px-3",
        className,
      )}
    >
      <MessageSquareIcon aria-hidden />
      <span className={compact ? "sr-only sm:not-sr-only" : undefined}>
        Message
      </span>
      <span className="sr-only">
        {" "}
        {patientName} ({tokenLabel})
      </span>
    </Button>
  );
}
