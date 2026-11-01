import {
  formatClinicDay,
  formatClinicTime,
} from "@/components/queue/token-display";
import type {
  Channel,
  DoctorRouting,
  InboxFilter,
  InboxItem,
} from "@/features/messaging/contracts";

// Words for the staff Messages screens.

export const INBOX_FILTER_LABELS: Record<InboxFilter, string> = {
  all: "All",
  unread: "Unread",
  open: "Open",
  closed: "Closed",
};

// Reception and clinic admins see reception chats, plus doctor chats they
// answer because no doctor serves the service.
export const CHANNEL_LABELS: Record<Channel, string> = {
  RECEPTION: "Reception chat",
  DOCTOR: "Doctor chat",
};

export function staffRoutingText(routing: DoctorRouting): string {
  switch (routing.kind) {
    case "ASSIGNED_DOCTOR":
      return `With ${routing.doctorName}`;
    case "SERVICE_DOCTORS":
      return `Any ${routing.serviceName} doctor can answer`;
    case "RECEPTION_FALLBACK":
      return "Reception answers: no doctor serves this service";
  }
}

export function inboxPreview(item: InboxItem): string {
  if (!item.lastMessage) return "No messages yet";
  return item.lastMessage.sender === "STAFF"
    ? `Staff: ${item.lastMessage.body}`
    : item.lastMessage.body;
}

// "09:05" today, "Thu, 29 Oct" before, in the clinic's timezone.
export function formatInboxTime(
  iso: string,
  timeZone: string,
  now: number,
): string {
  const day = formatClinicDay(iso, timeZone);
  return day === formatClinicDay(new Date(now).toISOString(), timeZone)
    ? formatClinicTime(iso, timeZone)
    : day;
}

// Message times: "09:05" today, "Thu, 29 Oct, 09:05" before.
export function formatMessageTime(iso: string, timeZone: string): string {
  const time = formatClinicTime(iso, timeZone);
  const day = formatClinicDay(iso, timeZone);
  return day === formatClinicDay(new Date().toISOString(), timeZone)
    ? time
    : `${day}, ${time}`;
}
