import { EyeIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { DeleteButton } from "@/components/platform/delete-button";
import { FilterChips, firstParam } from "@/components/platform/filter-chips";
import { IconLink, RowActions } from "@/components/platform/icon-action";
import { Pagination } from "@/components/platform/pagination";
import { TicketPill, formatDateTime } from "@/components/platform/pills";
import { PlatformPageSkeleton } from "@/components/platform/platform-shell";
import { requirePlatformPage } from "@/components/platform/platform-session";
import {
  EmptyState,
  ListCard,
  ListCount,
} from "@/components/platform/section-card";
import { TicketFormButton } from "@/components/platform/ticket-forms";
import { TicketStatusControl } from "@/components/platform/ticket-status-control";
import { listClinicOptions } from "@/features/platform/clinics";
import {
  SUPPORT_STATUSES,
  SUPPORT_STATUS_LABELS,
} from "@/features/platform/schemas";
import { PAGE_SIZE, parsePage } from "@/features/platform/pagination";
import { listSupportTicketsPage } from "@/features/platform/support";

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
  const params = await searchParams;
  const parsed = z.enum(SUPPORT_STATUSES).safeParse(firstParam(params.status));
  const status = parsed.success ? parsed.data : undefined;
  const [result, clinics] = await Promise.all([
    listSupportTicketsPage({
      status,
      page: parsePage(firstParam(params.page)),
      pageSize: PAGE_SIZE,
    }),
    listClinicOptions(),
  ]);
  const tickets = result.rows;
  // Status links start again at page 1; the pager keeps the status.
  const pageHref = (page: number) => {
    const query = new URLSearchParams();
    if (status) query.set("status", status);
    if (page > 1) query.set("page", String(page));
    const text = query.toString();
    return text ? `/super-admin/support?${text}` : "/super-admin/support";
  };

  return (
    <>
      <PageHeader
        title="Support"
        breadcrumbs={[{ label: "Support" }]}
        status="Opened by clinic staff from their support page, or by you."
        actions={<TicketFormButton clinics={clinics} />}
      />
      <ListCard
        toolbar={
          <>
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
            <ListCount count={result.total} one="ticket" many="tickets" />
          </>
        }
      >
        {tickets.length === 0 ? (
          <EmptyState className="m-5">No tickets here.</EmptyState>
        ) : (
          <ul className="flex flex-col">
            {tickets.map((ticket) => (
              <li
                key={ticket.id}
                className="flex flex-col gap-3 border-b border-divider px-5 py-4 last:border-b-0"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/super-admin/support/${ticket.id}`}
                      className="font-semibold underline-offset-4 hover:underline"
                    >
                      {ticket.subject}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {ticket.clinicName ?? "No clinic"} ·{" "}
                      {ticket.createdByName ?? "Unknown"} ·{" "}
                      {formatDateTime(ticket.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <TicketPill status={ticket.status} />
                    <TicketStatusControl
                      ticketId={ticket.id}
                      subject={ticket.subject}
                      status={ticket.status}
                    />
                    <RowActions>
                      <IconLink
                        href={`/super-admin/support/${ticket.id}`}
                        label={`View ticket ${ticket.subject}`}
                        tip="View"
                      >
                        <EyeIcon aria-hidden />
                      </IconLink>
                      <TicketFormButton ticket={ticket} />
                      <DeleteButton
                        compact
                        url={`/api/platform/support/${ticket.id}`}
                        itemName={`ticket “${ticket.subject}”`}
                        description="The ticket and its details are removed for good."
                        successMessage="Ticket deleted."
                      />
                    </RowActions>
                  </div>
                </div>
                <p className="line-clamp-3 rounded-btn bg-background px-4 py-3 text-sm whitespace-pre-line">
                  {ticket.body}
                </p>
              </li>
            ))}
          </ul>
        )}
        <Pagination result={result} href={pageHref} />
      </ListCard>
    </>
  );
}
