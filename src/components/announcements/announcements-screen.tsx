"use client";

import { MegaphoneIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { PageHeader, type Crumb } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  MESSAGING_API,
  type BroadcastSummary,
} from "@/features/messaging/contracts";
import { AnnouncementComposer } from "./announcement-composer";
import { AnnouncementList } from "./announcement-list";
import { LoadError } from "./load-error";
import { AnnouncementListSkeleton } from "./skeletons";
import { useApiResource } from "./use-api-resource";
import { useBroadcastLive } from "./use-broadcast-live";

// /receptionist/announcements and /admin/announcements: past announcements
// with their progress, and the composer in a side sheet.
export function AnnouncementsScreen({
  basePath,
  crumbs,
  timeZone,
}: {
  basePath: string;
  // The panel's crumbs before "Announcements".
  crumbs: Crumb[];
  timeZone: string;
}) {
  const { state, reload, retry } = useApiResource<BroadcastSummary[]>(
    MESSAGING_API.broadcasts,
  );
  const [composerOpen, setComposerOpen] = useState(false);
  const items = state.status === "ready" ? state.data : [];

  // Rows still sending update live; nothing is open once all are finished.
  useBroadcastLive({
    active: items.some((item) => item.status === "SENDING"),
    matches: (event) => event.type === "broadcast",
    onUpdate: () => void reload(),
  });

  return (
    <>
      <PageHeader
        title="Announcements"
        breadcrumbs={[...crumbs, { label: "Announcements" }]}
        status="One message to every waiting patient, delivered privately to each one's reception chat"
        actions={
          <AnnouncementComposer
            open={composerOpen}
            onOpenChange={setComposerOpen}
            basePath={basePath}
            onListChanged={() => void reload()}
          />
        }
      />

      {state.status === "loading" && <AnnouncementListSkeleton />}

      {state.status === "error" && (
        <LoadError
          title="Announcements couldn't load"
          message={state.error.message}
          onRetry={retry}
        />
      )}

      {state.status === "ready" && items.length === 0 && (
        <section
          aria-labelledby="announcements-empty"
          className="flex flex-col items-center gap-3 rounded-card border border-border bg-card px-6 py-12 text-center shadow-card"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-brand-tint text-brand">
            <MegaphoneIcon aria-hidden className="size-6" />
          </span>
          <h2 id="announcements-empty" className="text-[15px] font-semibold">
            No announcements yet
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Send one message to every patient waiting or called today, for
            example a delay. Each patient gets it privately in their own
            reception chat.
          </p>
          <Button
            variant="outline"
            className="h-10 rounded-btn px-4"
            onClick={() => setComposerOpen(true)}
          >
            <PlusIcon aria-hidden />
            Write the first one
          </Button>
        </section>
      )}

      {state.status === "ready" && items.length > 0 && (
        <DashboardCard
          title="Sent announcements"
          description="Newest first. Open one to see who got it and who has read it."
          bodyClassName="p-0"
        >
          {state.stale && (
            <p
              role="status"
              className="border-b border-divider bg-status-wait px-5 py-2 text-xs text-status-wait-foreground"
            >
              Can&apos;t reach the server. Showing the last update.
            </p>
          )}
          <AnnouncementList
            items={items}
            basePath={basePath}
            timeZone={timeZone}
            now={state.loadedAt}
          />
        </DashboardCard>
      )}
    </>
  );
}
