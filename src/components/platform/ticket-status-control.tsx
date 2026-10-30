"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  SUPPORT_STATUSES,
  SUPPORT_STATUS_LABELS,
} from "@/features/platform/schemas";
import type { SupportTicketStatus } from "@/generated/prisma/enums";
import { NativeSelect } from "./native-select";
import { errorMessage, requestJson } from "./request";

// Changing the select saves straight away; a failed save puts it back.
export function TicketStatusControl({
  ticketId,
  subject,
  status,
}: {
  ticketId: string;
  subject: string;
  status: SupportTicketStatus;
}) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [pending, setPending] = useState(false);

  async function change(next: SupportTicketStatus) {
    const previous = value;
    setValue(next);
    setPending(true);
    try {
      await requestJson(`/api/platform/support/${ticketId}`, {
        method: "PATCH",
        body: { status: next },
      });
      toast.success(
        `Ticket marked ${SUPPORT_STATUS_LABELS[next].toLowerCase()}.`,
      );
      router.refresh();
    } catch (error) {
      setValue(previous);
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <NativeSelect
      aria-label={`Status of “${subject}”`}
      value={value}
      disabled={pending}
      onChange={(event) => change(event.target.value as SupportTicketStatus)}
      className="w-40"
    >
      {SUPPORT_STATUSES.map((option) => (
        <option key={option} value={option}>
          {SUPPORT_STATUS_LABELS[option]}
        </option>
      ))}
    </NativeSelect>
  );
}
