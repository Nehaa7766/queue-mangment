"use client";

import {
  CheckCheckIcon,
  CheckIcon,
  CircleAlertIcon,
  Clock3Icon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatSettings } from "./chat-context";
import type { DeliveryStatus } from "./merge";

const DISPLAY: Record<DeliveryStatus, { icon: LucideIcon; className: string }> =
  {
    sending: { icon: Clock3Icon, className: "text-muted-foreground" },
    sent: { icon: CheckIcon, className: "text-muted-foreground" },
    seen: { icon: CheckCheckIcon, className: "font-semibold text-brand" },
    failed: {
      icon: CircleAlertIcon,
      className: "font-semibold text-destructive",
    },
  };

// Sending / Sent / Seen / Not sent under the viewer's own messages: an icon
// and a word, never colour alone.
export function MessageStatus({ status }: { status: DeliveryStatus }) {
  const { copy } = useChatSettings();
  const { icon: Icon, className } = DISPLAY[status];
  return (
    <span
      data-status={status}
      className={cn("inline-flex items-center gap-1", className)}
    >
      <Icon aria-hidden className="size-3.5" />
      {copy.status[status]}
    </span>
  );
}
