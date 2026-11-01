"use client";

import {
  ArrowLeftIcon,
  CheckCheckIcon,
  EyeIcon,
  HourglassIcon,
  RefreshCwIcon,
  SendIcon,
  SkipForwardIcon,
  TriangleAlertIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { TokenBadge } from "@/components/dashboard/list-row";
import { StatCard } from "@/components/dashboard/stat-card";
import { PageHeader, type Crumb } from "@/components/layout/page-header";
import { displayName } from "@/components/queue/token-display";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  BROADCAST_SKIP_REASONS,
  MESSAGING_API,
  type BroadcastDetail,
  type BroadcastRecipientStatus,
} from "@/features/messaging/contracts";
import { cn } from "@/lib/utils";
import { BroadcastStatusPill, RecipientStatusPill } from "./broadcast-status";
import {
  RECIPIENT_STATUS_DISPLAY,
  formatCount,
  formatWhen,
  handledCount,
  patientsLabel,
  percent,
  progressSentence,
  senderLabel,
  servicesLabel,
  skipReasonCounts,
} from "./format";
import { LoadError } from "./load-error";
import { AnnouncementDetailBodySkeleton } from "./skeletons";
import { useApiResource } from "./use-api-resource";
import { useBroadcastLive } from "./use-broadcast-live";

type Recipient = BroadcastDetail["recipients"][number];
type Filter = "ALL" | BroadcastRecipientStatus;

// Tall enough to tap on a tablet, where the table shows.
const TOKEN_LINK =
  "inline-flex min-h-10 items-center rounded-sm font-display text-base font-extrabold text-brand tabular-nums outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50";

// /…/announcements/[broadcastId]: counts, skip reasons and every recipient's
// status. While the announcement is sending it follows the staff event
// stream, with a 5-second poll as a fallback, and stops once it is done.
export function AnnouncementDetailScreen({
  broadcastId,
  basePath,
  crumbs,
  timeZone,
}: {
  broadcastId: string;
  basePath: string;
  crumbs: Crumb[];
  timeZone: string;
}) {
  const { state, reload, retry } = useApiResource<BroadcastDetail>(
    MESSAGING_API.broadcast(broadcastId),
  );
  const detail = state.status === "ready" ? state.data : null;

  useBroadcastLive({
    active: detail?.status === "SENDING",
    matches: (event) =>
      event.type === "broadcast" && event.broadcastId === broadcastId,
    onUpdate: () => void reload(),
  });

  const when =
    state.status === "ready"
      ? formatWhen(state.data.createdAt, timeZone, state.loadedAt)
      : null;

  return (
    <>
      <PageHeader
        title="Announcement"
        breadcrumbs={[
          ...crumbs,
          { label: "Announcements", href: basePath },
          { label: "Progress" },
        ]}
        status={
          detail && when
            ? `${when} · by ${senderLabel(detail.createdByName)} · ${servicesLabel(detail.serviceNames)}`
            : undefined
        }
        actions={
          <>
            <Link
              href={basePath}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-10 rounded-btn px-3",
              )}
            >
              <ArrowLeftIcon aria-hidden />
              All announcements
            </Link>
            {detail && (
              <Button
                variant="outline"
                className="h-10 rounded-btn px-3"
                onClick={() => void reload()}
              >
                <RefreshCwIcon aria-hidden />
                Refresh
              </Button>
            )}
          </>
        }
      />

      {state.status === "loading" && <AnnouncementDetailBodySkeleton />}

      {state.status === "error" &&
        (state.error.status === 404 ? (
          <LoadError
            title="Announcement not found"
            message="It may have been deleted with old patient data, or the link is wrong."
            backHref={basePath}
            backLabel="All announcements"
          />
        ) : (
          <LoadError
            title="This announcement couldn't load"
            message={state.error.message}
            onRetry={retry}
            backHref={basePath}
            backLabel="All announcements"
          />
        ))}

      {state.status === "ready" && (
        <DetailBody detail={state.data} stale={state.stale} when={when} />
      )}
    </>
  );
}

function DetailBody({
  detail,
  stale,
  when,
}: {
  detail: BroadcastDetail;
  stale: boolean;
  when: string | null;
}) {
  const { counts } = detail;
  const handled = handledCount(counts);
  const sending = detail.status === "SENDING";
  const reasons = skipReasonCounts(detail.recipients);

  return (
    <div className="flex flex-col gap-5">
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border px-4 py-3 shadow-card",
          sending
            ? "border-status-wait-foreground/20 bg-status-wait text-status-wait-foreground"
            : "border-border bg-card",
        )}
      >
        <BroadcastStatusPill status={detail.status} />
        {/* One sentence for screen readers when the numbers change. */}
        <p aria-live="polite" className="text-sm">
          <span className="sr-only">{progressSentence(detail)} </span>
          <span aria-hidden>
            {sending
              ? `${formatCount(handled)} of ${patientsLabel(counts.total)} handled. This page updates by itself.`
              : `All ${patientsLabel(counts.total)} handled. Seen changes as patients open their chat.`}
          </span>
        </p>
        {stale && (
          <p role="status" className="text-xs font-semibold text-danger-text">
            Can&apos;t reach the server. Showing the last update.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3">
        <StatCard
          icon={UsersIcon}
          value={formatCount(counts.total)}
          label="Patients"
          footerLabel="Handled"
          footerValue={`${formatCount(handled)} of ${formatCount(counts.total)}`}
          progress={percent(handled, counts.total)}
          tone="brand"
        />
        <StatCard
          icon={SendIcon}
          value={formatCount(counts.sent)}
          label="Sent"
          footerLabel="In their chat"
          footerValue={`${percent(counts.sent, counts.total)}%`}
          progress={percent(counts.sent, counts.total)}
          tone="green"
        />
        <StatCard
          icon={EyeIcon}
          value={formatCount(counts.seen)}
          label="Seen"
          footerLabel="Of sent"
          footerValue={`${percent(counts.seen, counts.sent)}%`}
          progress={percent(counts.seen, counts.sent)}
          tone="tan"
        />
        <StatCard
          icon={SkipForwardIcon}
          value={formatCount(counts.skipped)}
          label="Skipped"
          footerLabel="Visit changed"
          footerValue={`${percent(counts.skipped, counts.total)}%`}
          progress={percent(counts.skipped, counts.total)}
          tone="gray"
        />
        <StatCard
          icon={TriangleAlertIcon}
          value={formatCount(counts.failed)}
          label="Failed"
          footerLabel="After 5 tries"
          footerValue={`${percent(counts.failed, counts.total)}%`}
          progress={percent(counts.failed, counts.total)}
          tone="red"
        />
        <StatCard
          icon={HourglassIcon}
          value={formatCount(counts.pending)}
          label="Pending"
          footerLabel={sending ? "Still to send" : "Nothing left"}
          footerValue={`${percent(counts.pending, counts.total)}%`}
          progress={percent(counts.pending, counts.total)}
          tone="amber"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <DashboardCard
          title="Message"
          className="lg:self-start"
          bodyClassName="flex flex-col gap-4"
        >
          <p className="text-sm break-words whitespace-pre-wrap">
            {detail.body}
          </p>
          <dl className="grid gap-3 border-t border-divider pt-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Sent</dt>
              <dd className="font-medium">{when}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">By</dt>
              <dd className="font-medium">
                {detail.createdByName ?? "A staff member"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Services</dt>
              <dd className="font-medium">
                {servicesLabel(detail.serviceNames)}
              </dd>
            </div>
          </dl>
        </DashboardCard>

        <div className="flex flex-col gap-5">
          {counts.skipped > 0 && (
            <DashboardCard title="Why some were skipped" bodyClassName="py-2">
              <dl className="divide-y divide-divider">
                {reasons.map((reason) => (
                  <div
                    key={reason.reason}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <dt>{reason.label}</dt>
                    <dd className="font-semibold tabular-nums">
                      {formatCount(reason.count)}
                    </dd>
                  </div>
                ))}
              </dl>
            </DashboardCard>
          )}
          <DashboardCard title="What the statuses mean" bodyClassName="py-3">
            <dl className="flex flex-col gap-2.5 text-sm">
              <Meaning label="Sent">
                Stored in the patient&apos;s chat. If they aren&apos;t on their
                token page now, they see it when they open it.
              </Meaning>
              <Meaning label="Seen">The patient has opened the chat.</Meaning>
              <Meaning label="Skipped">
                Not sent because the visit changed first.
              </Meaning>
              <Meaning label="Failed">
                Couldn&apos;t be stored after 5 tries.
              </Meaning>
            </dl>
          </DashboardCard>
        </div>
      </div>

      <Recipients recipients={detail.recipients} />
    </div>
  );
}

function Meaning({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-semibold">{label}</dt>
      <dd className="text-muted-foreground">{children}</dd>
    </div>
  );
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "SENT", label: RECIPIENT_STATUS_DISPLAY.SENT.label },
  { key: "SKIPPED", label: RECIPIENT_STATUS_DISPLAY.SKIPPED.label },
  { key: "FAILED", label: RECIPIENT_STATUS_DISPLAY.FAILED.label },
  { key: "PENDING", label: RECIPIENT_STATUS_DISPLAY.PENDING.label },
];

function Recipients({ recipients }: { recipients: Recipient[] }) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const countOf = (key: Filter) =>
    key === "ALL"
      ? recipients.length
      : recipients.filter((recipient) => recipient.status === key).length;
  // Filters with nobody in them are hidden, except the one in use.
  const filters = FILTERS.filter(
    (item) => item.key === "ALL" || item.key === filter || countOf(item.key),
  );
  const shown =
    filter === "ALL"
      ? recipients
      : recipients.filter((recipient) => recipient.status === filter);

  return (
    <DashboardCard
      title="Recipients"
      description="One private message per patient, in their own reception chat."
      bodyClassName="p-0"
    >
      <div
        role="group"
        aria-label="Show recipients"
        className="flex flex-wrap gap-2 border-b border-divider px-5 py-3"
      >
        {filters.map((item) => {
          const active = item.key === filter;
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(item.key)}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                active
                  ? "border-brand bg-brand text-white"
                  : "border-border bg-card hover:bg-accent",
              )}
            >
              {item.label}
              <span className="tabular-nums">
                {formatCount(countOf(item.key))}
              </span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">
          No recipients with this status.
        </p>
      ) : (
        <>
          {/* Desktop and tablet: a table. */}
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Recipients</caption>
              <thead className="bg-muted text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-semibold">
                    Token
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    Patient
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    Service
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-2.5 font-semibold">
                    Seen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {shown.map((recipient) => (
                  <tr key={recipient.tokenId} className="hover:bg-accent/60">
                    <td className="px-5 py-3">
                      <Link
                        href={`/receptionist/tokens/${recipient.tokenId}`}
                        className={TOKEN_LINK}
                      >
                        {recipient.tokenLabel}
                      </Link>
                    </td>
                    <td className="px-3 py-3 font-medium break-words">
                      {displayName(recipient.patientName)}
                    </td>
                    <td className="px-3 py-3 break-words text-muted-foreground">
                      {recipient.serviceName}
                    </td>
                    <td className="px-3 py-3">
                      <RecipientStatusPill status={recipient.status} />
                      <StatusNote recipient={recipient} />
                    </td>
                    <td className="px-5 py-3">
                      <Seen recipient={recipient} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phones: one stacked card per patient, no sideways scrolling. */}
          <ul className="divide-y divide-divider md:hidden">
            {shown.map((recipient) => (
              <li
                key={recipient.tokenId}
                className="flex items-start gap-3 px-5 py-3.5"
              >
                <Link
                  href={`/receptionist/tokens/${recipient.tokenId}`}
                  className="shrink-0 rounded-btn outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="sr-only">Token </span>
                  <TokenBadge label={recipient.tokenLabel} />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold">
                    {displayName(recipient.patientName)}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {recipient.serviceName}
                  </span>
                  <StatusNote recipient={recipient} />
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <RecipientStatusPill status={recipient.status} />
                  <Seen recipient={recipient} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </DashboardCard>
  );
}

function StatusNote({ recipient }: { recipient: Recipient }) {
  const note =
    recipient.status === "SKIPPED" && recipient.skipReason
      ? BROADCAST_SKIP_REASONS[recipient.skipReason]
      : recipient.status === "FAILED"
        ? "Not stored after 5 tries"
        : null;
  return note ? (
    <span className="mt-1 block text-xs text-muted-foreground">{note}</span>
  ) : null;
}

function Seen({ recipient }: { recipient: Recipient }) {
  if (recipient.status !== "SENT") {
    return (
      <span className="text-xs text-muted-foreground">
        <span aria-hidden>—</span>
        <span className="sr-only">Not sent</span>
      </span>
    );
  }
  return recipient.seen ? (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-status-done-foreground">
      <CheckCheckIcon aria-hidden className="size-4" />
      Seen
    </span>
  ) : (
    <span className="text-xs text-muted-foreground">Not seen yet</span>
  );
}
