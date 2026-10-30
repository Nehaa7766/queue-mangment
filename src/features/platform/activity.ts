import { requirePlatformAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { pageWindow, type Paginated } from "./pagination";

export type ActivityTarget = {
  // "Clinic", "User", …
  type: string;
  // The target's current name, or the name it had when it was deleted.
  label: string;
  // Where it can be seen, when a page exists and it still exists.
  href: string | null;
};

export type PlatformActivity = {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  target: ActivityTarget;
  actorName: string | null;
  createdAt: string;
  metadata: unknown;
};

export const ACTION_LABELS: Record<string, string> = {
  "clinic.signed_up": "Clinic signed up",
  "clinic.created": "Clinic added",
  "clinic.activated": "Clinic activated",
  "clinic.suspended": "Clinic suspended",
  "clinic.updated": "Clinic details edited",
  "clinic.deleted": "Clinic deleted",
  // Kept for history: super admins can no longer be added.
  "user.created": "Super admin added",
  "admin.invited": "Clinic admin invited",
  "admin.added": "Clinic admin added",
  "user.updated": "User edited",
  "user.deactivated": "User deactivated",
  "user.reactivated": "User reactivated",
  "user.password_reset_sent": "Password reset sent",
  "user.deleted": "User deleted",
  // Kept for history: the billing screens were removed on 2026-10-30.
  "plan.created": "Plan added",
  "plan.updated": "Plan edited",
  "plan.deleted": "Plan deleted",
  "subscription.created": "Subscription created",
  "subscription.updated": "Subscription updated",
  "support_ticket.created": "Support ticket opened",
  "support_ticket.updated": "Support ticket edited",
  "support_ticket.status_changed": "Support ticket status changed",
  "support_ticket.deleted": "Support ticket deleted",
  "platform_settings.updated": "Platform settings changed",
};

export const TARGET_TYPE_LABELS: Record<string, string> = {
  clinic: "Clinic",
  user: "User",
  // Kept for history, like their actions above.
  plan: "Plan",
  subscription: "Subscription",
  support_ticket: "Support ticket",
  platform_setting: "Platform settings",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

type EventRef = {
  targetType: string;
  targetId: string | null;
  metadata: unknown;
};

function key(type: string, id: string): string {
  return `${type}:${id}`;
}

// The name a deleted target had, from its audit metadata.
function deletedLabel(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const record = metadata as Record<string, unknown>;
  for (const field of ["name", "email", "code", "slug"]) {
    if (typeof record[field] === "string") return record[field] as string;
  }
  return null;
}

// Looks up every target's current name in one query per type.
async function resolveTargets(
  events: readonly EventRef[],
): Promise<Map<string, Omit<ActivityTarget, "type">>> {
  const ids = (type: string) => [
    ...new Set(
      events
        .filter((event) => event.targetType === type && event.targetId)
        .map((event) => event.targetId as string),
    ),
  ];
  const db = getDb();
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const only = (list: string[]) => list.filter((id) => uuid.test(id));
  const [clinics, users, tickets] = await Promise.all([
    db.clinic.findMany({
      where: { id: { in: only(ids("clinic")) } },
      select: { id: true, name: true },
    }),
    db.user.findMany({
      where: { id: { in: only(ids("user")) } },
      select: { id: true, name: true },
    }),
    db.supportTicket.findMany({
      where: { id: { in: only(ids("support_ticket")) } },
      select: { id: true, subject: true },
    }),
  ]);

  const found = new Map<string, Omit<ActivityTarget, "type">>();
  for (const clinic of clinics) {
    found.set(key("clinic", clinic.id), {
      label: clinic.name,
      href: `/super-admin/clinics/${clinic.id}`,
    });
  }
  for (const user of users) {
    found.set(key("user", user.id), {
      label: user.name,
      href: `/super-admin/users/${user.id}`,
    });
  }
  for (const ticket of tickets) {
    found.set(key("support_ticket", ticket.id), {
      label: ticket.subject,
      href: `/super-admin/support/${ticket.id}`,
    });
  }
  return found;
}

function targetOf(
  event: EventRef,
  found: Map<string, Omit<ActivityTarget, "type">>,
): ActivityTarget {
  const type = TARGET_TYPE_LABELS[event.targetType] ?? event.targetType;
  if (event.targetType === "platform_setting") {
    return { type, label: "Platform settings", href: "/super-admin/settings" };
  }
  // Billing targets have no screen any more; show the name they were logged with.
  if (event.targetType === "plan" || event.targetType === "subscription") {
    return { type, label: deletedLabel(event.metadata) ?? type, href: null };
  }
  const current = event.targetId
    ? found.get(key(event.targetType, event.targetId))
    : undefined;
  if (current) return { type, ...current };
  const gone = deletedLabel(event.metadata);
  return { type, label: gone ? `${gone} (deleted)` : "Deleted", href: null };
}

const eventSelect = {
  id: true,
  action: true,
  targetType: true,
  targetId: true,
  createdAt: true,
  metadata: true,
  actor: { select: { name: true } },
} as const;

// Newest first; the id breaks ties, so pages never repeat or skip a row.
const NEWEST_FIRST = [{ createdAt: "desc" as const }, { id: "desc" as const }];

async function toActivity(
  events: {
    id: string;
    action: string;
    targetType: string;
    targetId: string | null;
    createdAt: Date;
    metadata: unknown;
    actor: { name: string } | null;
  }[],
): Promise<PlatformActivity[]> {
  const found = await resolveTargets(events);
  return events.map((event) => ({
    id: event.id,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId,
    target: targetOf(event, found),
    actorName: event.actor?.name ?? null,
    createdAt: event.createdAt.toISOString(),
    metadata: event.metadata,
  }));
}

export async function listPlatformActivity(options?: {
  limit?: number;
  // Only what this user did, for their detail page.
  actorUserId?: string;
}): Promise<PlatformActivity[]> {
  await requirePlatformAdmin();
  const events = await getDb().platformAuditEvent.findMany({
    where: options?.actorUserId
      ? { actorUserId: options.actorUserId }
      : undefined,
    orderBy: NEWEST_FIRST,
    take: Math.min(options?.limit ?? 100, 200),
    select: eventSelect,
  });
  return toActivity(events);
}

// One page of the whole log, for the activity log and the dashboard.
export async function listPlatformActivityPage(options: {
  page: number;
  pageSize: number;
}): Promise<Paginated<PlatformActivity>> {
  await requirePlatformAdmin();
  const db = getDb();
  const total = await db.platformAuditEvent.count();
  const { page, pageCount, skip } = pageWindow(
    options.page,
    total,
    options.pageSize,
  );
  const events = await db.platformAuditEvent.findMany({
    orderBy: NEWEST_FIRST,
    skip,
    take: options.pageSize,
    select: eventSelect,
  });
  return {
    rows: await toActivity(events),
    total,
    page,
    pageCount,
    pageSize: options.pageSize,
  };
}
