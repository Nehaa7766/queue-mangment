import type { Metadata } from "next";
import { Suspense } from "react";
import { z } from "zod";
import { FilterChips, firstParam } from "@/components/platform/filter-chips";
import { TicketPill, formatDateTime } from "@/components/platform/pills";
import {
  PlatformPageHeader,
  PlatformPageSkeleton,
} from "@/components/platform/platform-shell";
import { requirePlatformPage } from "@/components/platform/platform-session";
import { EmptyState } from "@/components/platform/section-card";
import { TicketStatusControl } from "@/components/platform/ticket-status-control";
import {
  SUPPORT_STATUSES,
  SUPPORT_STATUS_LABELS,
} from "@/features/platform/schemas";
import { listSupportTickets } from "@/features/platform/support";

export const metadata: Metadata = { title: "Support · QueueCare" };

type SearchParams = PageProps<"/super-admin/support">["searchParams"];

export default function SupportPage({
  searchParams,
}: PageProps<"/super-admin/support">) {
  return (
    <Suspense fallback={<PlatformPageSkeleton />}>
      <Support searchParams={searchParams} />
    </Suspense>
  );
}

async function Support({ searchParams }: { searchParams: SearchParams }) {
  await requirePlatformPage();
  const parsed = z
    .enum(SUPPORT_STATUSES)
    .safeParse(firstParam((await searchParams).status));
  const status = parsed.success ? parsed.data : undefined;
  const tickets = await listSupportTickets({ status });

  return (
    <>
      <PlatformPageHeader
        title="Support"
        description="Tickets opened by clinic staff from their support page."
      />
      <div className="mb-4">
        <FilterChips
          label="Filter by status"
          chips={[
            { label: "All", href: "/super-admin/support", active: !status },
            ...SUPPORT_STATUSES.map((option) => ({
              label: SUPPORT_STATUS_LABELS[option],
              href: `/super-admin/support?status=${option}`,
              active: status === option,
            })),
          ]}
        />
      </div>

      {tickets.length === 0 ? (
        <EmptyState>No tickets here.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {tickets.map((ticket) => (
            <li
              key={ticket.id}
              className="flex flex-col gap-3 rounded-card border border-border bg-card p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{ticket.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {ticket.clinicName ?? "No clinic"} ·{" "}
                    {ticket.createdByName ?? "Unknown"} ·{" "}
                    {formatDateTime(ticket.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <TicketPill status={ticket.status} />
                  <TicketStatusControl
                    ticketId={ticket.id}
                    subject={ticket.subject}
                    status={ticket.status}
                  />
                </div>
              </div>
              <p className="text-sm whitespace-pre-line">{ticket.body}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
