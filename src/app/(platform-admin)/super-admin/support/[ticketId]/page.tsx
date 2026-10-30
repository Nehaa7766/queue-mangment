import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DeleteButton } from "@/components/platform/delete-button";
import { RowActions } from "@/components/platform/icon-action";
import { TicketPill, formatDateTime } from "@/components/platform/pills";
import { PlatformPageSkeleton } from "@/components/platform/platform-shell";
import { requirePlatformPage } from "@/components/platform/platform-session";
import {
  DetailList,
  DetailRow,
  SectionCard,
} from "@/components/platform/section-card";
import { TicketFormButton } from "@/components/platform/ticket-forms";
import { TicketStatusControl } from "@/components/platform/ticket-status-control";
import { getSupportTicket } from "@/features/platform/support";

export const metadata: Metadata = { title: "Support ticket · QueueCare" };

type Params = PageProps<"/super-admin/support/[ticketId]">["params"];

const LINK = "font-medium text-brand underline-offset-4 hover:underline";

export default function TicketDetailPage({
  params,
}: PageProps<"/super-admin/support/[ticketId]">) {
  return (
    <Suspense fallback={<PlatformPageSkeleton />}>
      <TicketDetail params={params} />
    </Suspense>
  );
}

async function TicketDetail({ params }: { params: Params }) {
  await requirePlatformPage();
  const ticket = await getSupportTicket((await params).ticketId);
  if (!ticket) notFound();

  return (
    <>
      <PageHeader
        title={ticket.subject}
        breadcrumbs={[
          { label: "Support", href: "/super-admin/support" },
          { label: ticket.subject },
        ]}
        status={<TicketPill status={ticket.status} />}
        actions={
          <RowActions>
            <TicketStatusControl
              ticketId={ticket.id}
              subject={ticket.subject}
              status={ticket.status}
            />
            <TicketFormButton ticket={ticket} />
            <DeleteButton
              compact
              url={`/api/platform/support/${ticket.id}`}
              itemName={`ticket “${ticket.subject}”`}
              description="The ticket and its details are removed for good."
              successMessage="Ticket deleted."
              redirectTo="/super-admin/support"
            />
          </RowActions>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard
          title="Message"
          className="lg:col-span-2"
          bodyClassName="py-4"
        >
          <p className="text-sm whitespace-pre-line">{ticket.body}</p>
        </SectionCard>

        <SectionCard title="Details" bodyClassName="py-2">
          <DetailList>
            <DetailRow label="Clinic">
              {ticket.clinicId && ticket.clinicName ? (
                <Link
                  href={`/super-admin/clinics/${ticket.clinicId}`}
                  className={LINK}
                >
                  {ticket.clinicName}
                </Link>
              ) : (
                "No clinic"
              )}
            </DetailRow>
            <DetailRow label="Opened by">
              {ticket.createdById && ticket.createdByName ? (
                <Link
                  href={`/super-admin/users/${ticket.createdById}`}
                  className={LINK}
                >
                  {ticket.createdByName}
                </Link>
              ) : (
                "Unknown"
              )}
            </DetailRow>
            <DetailRow label="Status">
              <TicketPill status={ticket.status} />
            </DetailRow>
            <DetailRow label="Opened">
              {formatDateTime(ticket.createdAt)}
            </DetailRow>
            <DetailRow label="Last updated">
              {formatDateTime(ticket.updatedAt)}
            </DetailRow>
          </DetailList>
        </SectionCard>
      </div>
    </>
  );
}
