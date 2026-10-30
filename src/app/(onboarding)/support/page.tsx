import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { loadStaffContext } from "@/components/layout/staff-session";
import { SupportTicketForm } from "@/components/onboarding/support-ticket-form";
import { TicketPill, formatDateTime } from "@/components/platform/pills";
import { EmptyState, SectionCard } from "@/components/platform/section-card";
import { Skeleton } from "@/components/ui/skeleton";
import { listClinicTickets } from "@/features/platform/support";

export const metadata: Metadata = { title: "Support · QueueCare" };

export default function SupportPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-card" />}>
      <Support />
    </Suspense>
  );
}

async function Support() {
  const staff = await loadStaffContext();
  if (!staff) redirect("/login");
  const tickets = await listClinicTickets();

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-[26px] font-bold">Support</h1>
        <p className="text-sm text-muted-foreground">
          Something not working at {staff.clinic.name}? Tell us and the
          QueueCare team will follow up.
        </p>
      </header>
      <SupportTicketForm />
      <SectionCard title="Your clinic's tickets">
        {tickets.length === 0 ? (
          <EmptyState>No tickets yet.</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-divider">
            {tickets.map((ticket) => (
              <li
                key={ticket.id}
                className="flex items-start justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{ticket.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {ticket.createdByName ?? "Unknown"} ·{" "}
                    {formatDateTime(ticket.createdAt)}
                  </p>
                </div>
                <TicketPill status={ticket.status} />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
