import type { Metadata } from "next";
import { Suspense } from "react";
import { formatDateTime } from "@/components/platform/pills";
import {
  PlatformPageHeader,
  PlatformPageSkeleton,
} from "@/components/platform/platform-shell";
import { requirePlatformPage } from "@/components/platform/platform-session";
import { EmptyState } from "@/components/platform/section-card";
import {
  ACTION_LABELS,
  listPlatformActivity,
} from "@/features/platform/activity";

export const metadata: Metadata = { title: "Activity log · QueueCare" };

const TARGET_LABELS: Record<string, string> = {
  clinic: "Clinic",
  user: "User",
  subscription: "Subscription",
  support_ticket: "Support ticket",
  platform_setting: "Platform settings",
};

export default function ActivityPage() {
  return (
    <Suspense fallback={<PlatformPageSkeleton />}>
      <Activity />
    </Suspense>
  );
}

async function Activity() {
  await requirePlatformPage();
  const events = await listPlatformActivity({ limit: 200 });

  return (
    <>
      <PlatformPageHeader
        title="Activity log"
        description="Every platform admin action and self-service sign-up, newest first."
      />
      {events.length === 0 ? (
        <EmptyState>No platform actions yet.</EmptyState>
      ) : (
        <ol className="flex flex-col divide-y divide-divider rounded-card border border-border bg-card">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex flex-col gap-1 p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold">
                  {ACTION_LABELS[event.action] ?? event.action}
                </p>
                <p className="text-xs text-muted-foreground">
                  {event.actorName ?? "System"} ·{" "}
                  {TARGET_LABELS[event.targetType] ?? event.targetType}
                  {event.targetId && (
                    <span className="font-mono">
                      {" "}
                      {event.targetId.slice(0, 8)}
                    </span>
                  )}
                </p>
              </div>
              <time
                dateTime={event.createdAt}
                className="shrink-0 text-xs text-muted-foreground tabular-nums"
              >
                {formatDateTime(event.createdAt)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
