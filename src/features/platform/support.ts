import { z } from "zod";
import type { SupportTicketStatus } from "@/generated/prisma/enums";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { getStaffContext } from "@/lib/auth/staff-context";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { recordPlatformAudit } from "./audit";
import type { SupportTicketCreate } from "./schemas";

const LIST_LIMIT = 100;

export type SupportTicketView = {
  id: string;
  subject: string;
  body: string;
  status: SupportTicketStatus;
  clinicName: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};

const ticketSelect = {
  id: true,
  subject: true,
  body: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  clinic: { select: { name: true } },
  createdBy: { select: { name: true } },
} as const;

function toView(ticket: {
  id: string;
  subject: string;
  body: string;
  status: SupportTicketStatus;
  createdAt: Date;
  updatedAt: Date;
  clinic: { name: string } | null;
  createdBy: { name: string } | null;
}): SupportTicketView {
  return {
    id: ticket.id,
    subject: ticket.subject,
    body: ticket.body,
    status: ticket.status,
    clinicName: ticket.clinic?.name ?? null,
    createdByName: ticket.createdBy?.name ?? null,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}

async function requireStaff() {
  const context = await getStaffContext();
  if (!context) {
    throw new AppError("UNAUTHENTICATED", "Please sign in to continue.");
  }
  return context;
}

// ---- Clinic staff ----

export async function createSupportTicket(
  input: SupportTicketCreate,
): Promise<SupportTicketView> {
  const staff = await requireStaff();
  const ticket = await getDb().supportTicket.create({
    data: {
      clinicId: staff.clinic.id,
      createdByUserId: staff.user.userId,
      subject: input.subject,
      body: input.body,
    },
    select: ticketSelect,
  });
  return toView(ticket);
}

export async function listClinicTickets(): Promise<SupportTicketView[]> {
  const staff = await requireStaff();
  const tickets = await getDb().supportTicket.findMany({
    where: { clinicId: staff.clinic.id },
    orderBy: { createdAt: "desc" },
    take: LIST_LIMIT,
    select: ticketSelect,
  });
  return tickets.map(toView);
}

// ---- Platform admins ----

export async function listSupportTickets(filters: {
  status?: SupportTicketStatus;
}): Promise<SupportTicketView[]> {
  await requirePlatformAdmin();
  const tickets = await getDb().supportTicket.findMany({
    where: filters.status ? { status: filters.status } : undefined,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: LIST_LIMIT,
    select: ticketSelect,
  });
  return tickets.map(toView);
}

export async function updateTicketStatus(
  ticketId: string,
  status: SupportTicketStatus,
): Promise<SupportTicketView> {
  const admin = await requirePlatformAdmin();
  const notFound = () =>
    new AppError("VALIDATION_ERROR", "This ticket could not be found.");
  if (!z.uuid().safeParse(ticketId).success) throw notFound();
  return getDb().$transaction(async (tx) => {
    const ticket = await tx.supportTicket.findUnique({
      where: { id: ticketId },
      select: { status: true },
    });
    if (!ticket) throw notFound();
    const updated = await tx.supportTicket.update({
      where: { id: ticketId },
      data: { status },
      select: ticketSelect,
    });
    if (ticket.status !== status) {
      await recordPlatformAudit(tx, {
        actorUserId: admin.userId,
        action: "support_ticket.status_changed",
        targetType: "support_ticket",
        targetId: ticketId,
        metadata: { previousStatus: ticket.status, newStatus: status },
      });
    }
    return toView(updated);
  });
}
