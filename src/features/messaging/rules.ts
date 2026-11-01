import { z } from "zod";
import type { MembershipRole } from "@/generated/prisma/enums";
import type { TokenStatus } from "@/features/queue/token-status";
import { can } from "@/lib/auth/permissions";
import {
  CHANNELS,
  CLOSE_AFTER_JOIN_MS,
  CLOSE_AFTER_VISIT_MS,
  type Channel,
  type DoctorRouting,
  type MessagingEvent,
} from "./contracts";

// Pure messaging rules (docs/MESSAGING.md): when a chat closes, who may see
// it, and which live hints each stream receives. No database access here, so
// the rules are unit-tested directly; access.ts applies them to loaded rows.

// ---- Closing ----

export type ClosureToken = {
  status: TokenStatus;
  joinedAt: Date;
  completedAt: Date | null;
  cancelledAt: Date | null;
  skippedAt: Date | null;
};

// When the visit ended: completed, cancelled or marked as a no-show. Null
// while it is still going, including after a requeue (skippedAt is cleared).
export function visitEndedAt(token: ClosureToken): Date | null {
  switch (token.status) {
    case "COMPLETED":
      return token.completedAt;
    case "CANCELLED":
      return token.cancelledAt;
    case "SKIPPED":
      return token.skippedAt;
    default:
      return null;
  }
}

// The moment the chat turns read-only: 2 hours after the visit ends, or a
// day after joining, whichever comes first.
export function closesAt(token: ClosureToken): Date {
  const byJoin = token.joinedAt.getTime() + CLOSE_AFTER_JOIN_MS;
  const ended = visitEndedAt(token);
  const byVisit = ended ? ended.getTime() + CLOSE_AFTER_VISIT_MS : Infinity;
  return new Date(Math.min(byJoin, byVisit));
}

export function isConversationClosed(
  token: ClosureToken,
  now: Date = new Date(),
): boolean {
  return now.getTime() >= closesAt(token).getTime();
}

// ---- Routing ----

export type DoctorRoutingKind = DoctorRouting["kind"];

// The signed-in staff member, as the routing rule sees them.
export type StaffViewer = {
  userId: string;
  clinicId: string;
  role: MembershipRole;
  // Doctors: the services they are assigned to. Empty means every service
  // (src/features/doctor/serving-doctors.ts).
  doctorServiceIds: readonly string[];
};

// One side of one token's chat, with everything the rule needs.
export type ChatTarget = {
  clinicId: string;
  channel: Channel;
  serviceId: string;
  assignedDoctorId: string | null;
  // DOCTOR channel only.
  routing: DoctorRoutingKind | null;
};

// Who answers a doctor chat right now: the doctor who started the
// consultation; before that the doctors serving the service; reception when
// no active doctor serves it.
export function doctorRoutingKind(
  assignedDoctorId: string | null,
  serviceHasDoctor: boolean,
): DoctorRoutingKind {
  if (assignedDoctorId) return "ASSIGNED_DOCTOR";
  return serviceHasDoctor ? "SERVICE_DOCTORS" : "RECEPTION_FALLBACK";
}

export function doctorServes(
  viewer: Pick<StaffViewer, "doctorServiceIds">,
  serviceId: string,
): boolean {
  return (
    viewer.doctorServiceIds.length === 0 ||
    viewer.doctorServiceIds.includes(serviceId)
  );
}

// Whether a staff member may read and (while open) answer this chat.
// Computed from the token's current state on every request; nothing about
// access is stored.
export function canStaffAccess(
  viewer: StaffViewer,
  target: ChatTarget,
): boolean {
  if (viewer.clinicId !== target.clinicId) return false;
  if (target.channel === "RECEPTION") {
    return can(viewer.role, "messages.reception");
  }
  switch (target.routing) {
    case "ASSIGNED_DOCTOR":
      return (
        can(viewer.role, "messages.doctor") &&
        viewer.userId === target.assignedDoctorId
      );
    case "SERVICE_DOCTORS":
      return (
        can(viewer.role, "messages.doctor") &&
        doctorServes(viewer, target.serviceId)
      );
    case "RECEPTION_FALLBACK":
      return can(viewer.role, "messages.reception");
    default:
      return false;
  }
}

// ---- Live notifications ----

// What travels through pg_notify: ids and routing only, never message text.
// `actor` is the side that caused it, so a "read" only reaches the other side.
export const MESSAGING_NOTIFY_CHANNEL = "queuecare_messaging";

const routingKindSchema = z.enum([
  "ASSIGNED_DOCTOR",
  "SERVICE_DOCTORS",
  "RECEPTION_FALLBACK",
]);

export const messagingNotificationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.enum(["message", "read", "conversation"]),
    clinicId: z.string(),
    conversationId: z.string(),
    tokenId: z.string(),
    channel: z.enum(CHANNELS),
    serviceId: z.string(),
    assignedDoctorId: z.string().nullable(),
    routing: routingKindSchema.nullable(),
    // Routing before this change, when it moved (a doctor started the visit).
    previousRouting: routingKindSchema.nullable().optional(),
    actor: z.enum(["PATIENT", "STAFF", "SYSTEM"]),
  }),
  z.object({
    type: z.literal("broadcast"),
    clinicId: z.string(),
    broadcastId: z.string(),
  }),
]);

export type MessagingNotification = z.infer<typeof messagingNotificationSchema>;
export type ChatNotification = Extract<
  MessagingNotification,
  { type: "message" | "read" | "conversation" }
>;

// The hint a patient's stream gets, or null. Matched by token only.
export function patientEventFor(
  tokenId: string,
  notification: MessagingNotification,
): MessagingEvent | null {
  if (notification.type === "broadcast" || notification.tokenId !== tokenId) {
    return null;
  }
  if (notification.type === "read" && notification.actor === "PATIENT") {
    return null;
  }
  return chatEvent(notification);
}

// The hint a staff member's stream gets, or null. Uses the role, user id and
// doctor services loaded when the stream opened.
export function staffEventFor(
  viewer: StaffViewer,
  notification: MessagingNotification,
): MessagingEvent | null {
  if (notification.clinicId !== viewer.clinicId) return null;
  if (notification.type === "broadcast") {
    return can(viewer.role, "announcements.send")
      ? { type: "broadcast", broadcastId: notification.broadcastId }
      : null;
  }
  if (notification.type === "read" && notification.actor === "STAFF") {
    return null;
  }
  if (canStaffAccess(viewer, notification)) {
    return chatEvent(notification);
  }
  // When routing moves, whoever just lost the chat also gets a hint, so their
  // screen refetches and drops it. REST then answers 404.
  if (
    notification.type === "conversation" &&
    notification.channel === "DOCTOR"
  ) {
    const hadIt =
      (can(viewer.role, "messages.doctor") &&
        doctorServes(viewer, notification.serviceId)) ||
      (can(viewer.role, "messages.reception") &&
        notification.previousRouting === "RECEPTION_FALLBACK");
    if (hadIt) return chatEvent(notification);
  }
  return null;
}

function chatEvent(notification: ChatNotification): MessagingEvent {
  return {
    type: notification.type,
    conversationId: notification.conversationId,
    channel: notification.channel,
  };
}

// ---- Text ----

export const PREVIEW_LENGTH = 120;

// Inbox preview: at most 120 characters on one line.
export function previewText(body: string): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length <= PREVIEW_LENGTH
    ? flat
    : `${flat.slice(0, PREVIEW_LENGTH - 1).trimEnd()}…`;
}
