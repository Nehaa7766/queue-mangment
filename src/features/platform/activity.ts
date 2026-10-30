import { requirePlatformAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";

export type PlatformActivity = {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  actorName: string | null;
  createdAt: string;
  metadata: unknown;
};

export const ACTION_LABELS: Record<string, string> = {
  "clinic.signed_up": "Clinic signed up",
  "clinic.activated": "Clinic activated",
  "clinic.suspended": "Clinic suspended",
  "user.deactivated": "User deactivated",
  "user.reactivated": "User reactivated",
  "subscription.created": "Subscription created",
  "subscription.updated": "Subscription updated",
  "support_ticket.status_changed": "Support ticket updated",
  "platform_settings.updated": "Platform settings changed",
};

export async function listPlatformActivity(options?: {
  limit?: number;
}): Promise<PlatformActivity[]> {
  await requirePlatformAdmin();
  const events = await getDb().platformAuditEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(options?.limit ?? 100, 200),
    select: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      createdAt: true,
      metadata: true,
      actor: { select: { name: true } },
    },
  });
  return events.map((event) => ({
    id: event.id,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId,
    actorName: event.actor?.name ?? null,
    createdAt: event.createdAt.toISOString(),
    metadata: event.metadata,
  }));
}
