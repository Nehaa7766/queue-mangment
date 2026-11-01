import { z } from "zod";

// Labels for audit actions, which are dotted verbs such as "token.called".

export const AUDIT_CATEGORIES = [
  "token",
  "consultation",
  "queue",
  "doctor",
  "service",
  "staff",
  "clinic",
  "message",
] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

export const AUDIT_CATEGORY_LABELS: Record<AuditCategory, string> = {
  token: "Tokens",
  consultation: "Consultations",
  queue: "Queues",
  doctor: "Doctors",
  service: "Services",
  staff: "Staff",
  clinic: "Clinic settings",
  message: "Messages",
};

const ACTION_LABELS: Record<string, string> = {
  "token.joined": "Joined by QR code",
  "token.walk_in_registered": "Walk-in registered",
  "token.called": "Token called",
  "token.recalled": "Token recalled",
  "token.skipped": "Marked as no-show",
  "token.requeued": "Moved back to the queue",
  "token.cancelled": "Token cancelled",
  "consultation.started": "Consultation started",
  "consultation.completed": "Consultation completed",
  "queue.paused": "Queue paused",
  "queue.resumed": "Queue resumed",
  "queue.closed": "Queue closed",
  "service.created": "Service added",
  "service.updated": "Service edited",
  "service.disabled": "Service turned off",
  "service.enabled": "Service turned back on",
  "staff.invited": "Staff member invited",
  "staff.invitation_revoked": "Invitation cancelled",
  "staff.invitation_accepted": "Invitation accepted",
  "staff.role_changed": "Role changed",
  "staff.deactivated": "Staff access removed",
  "staff.reactivated": "Staff access restored",
  "staff.password_reset": "Password reset by an admin",
  "staff.doctor_services_updated": "Doctor's services changed",
  "clinic.profile_updated": "Clinic profile edited",
  "clinic.queue_settings_updated": "Queue settings changed",
  "clinic.hours_updated": "Opening hours changed",
  "clinic.holiday_added": "Holiday added",
  "clinic.holiday_removed": "Holiday removed",
  "message.doctor_assigned": "Doctor took over the patient's chat",
  "message.broadcast_sent": "Announcement sent",
  "retention.patient_names_cleared": "Old patient names cleared",
  "retention.messages_deleted": "Old messages deleted",
};

// Known actions get a fixed label; new ones still read sensibly.
export function describeAction(action: string): string {
  const known = ACTION_LABELS[action];
  if (known) return known;
  const [category = "", verb = ""] = action.split(".");
  const words = `${category} ${verb}`.replaceAll("_", " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function auditCategory(action: string): string {
  return action.split(".")[0] ?? action;
}

// Filters from a query string. Malformed values are ignored, not rejected.
export function parseAuditFilters(raw: {
  date?: string | null;
  actor?: string | null;
  category?: string | null;
}): { date?: string; actorUserId?: string; category?: AuditCategory } {
  const date = z.iso.date().safeParse(raw.date);
  const actor = z.uuid().safeParse(raw.actor);
  const category = z.enum(AUDIT_CATEGORIES).safeParse(raw.category);
  return {
    date: date.success ? date.data : undefined,
    actorUserId: actor.success ? actor.data : undefined,
    category: category.success ? category.data : undefined,
  };
}
