import { z } from "zod";
import type { SupportTicketStatus } from "@/generated/prisma/enums";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { getStaffContext } from "@/lib/auth/staff-context";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { recordPlatformAudit } from "./audit";
import { pageWindow, type Paginated } from "./pagination";
import type {
  SupportTicketAdminCreate,
  SupportTicketCreate,
  SupportTicketEdit,
} from "./schemas";

const LIST_LIMIT = 100;

export type SupportTicketView = {
  id: string;
  subject: string;
  body: string;
  status: SupportTicketStatus;
  clinicId: string | null;
  clinicName: string | null;
  createdById: string | null;
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
  clinicId: true,
  clinic: { select: { name: true } },
  createdBy: { select: { id: true, name: true } },
} as const;

function toView(ticket: {
  id: string;
  subject: string;
  body: string;
  status: SupportTicketStatus;
  createdAt: Date;
  updatedAt: Date;
  clinicId: string | null;
  clinic: { name: string } | null;
  createdBy: { id: string; name: string } | null;
}): SupportTicketView {
  return {
    id: ticket.id,
    subject: ticket.subject,
    body: ticket.body,
    status: ticket.status,
    clinicId: ticket.clinicId,
    clinicName: ticket.clinic?.name ?? null,
    createdById: ticket.createdBy?.id ?? null,
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

// One page of tickets: open ones first, then newest first (the id breaks
// ties, so pages never repeat a row).
export async function listSupportTicketsPage(filters: {
  status?: SupportTicketStatus;
  page: number;
  pageSize: number;
}): Promise<Paginated<SupportTicketView>> {
  await requirePlatformAdmin();
  const db = getDb();
  const where = filters.status ? { status: filters.status } : undefined;
  const total = await db.supportTicket.count({ where });
  const { page, pageCount, skip } = pageWindow(
    filters.page,
    total,
    filters.pageSize,
  );
  const tickets = await db.supportTicket.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }, { id: "desc" }],
    skip,
    take: filters.pageSize,
    select: ticketSelect,
  });
  return {
    rows: tickets.map(toView),
    total,
    page,
    pageCount,
    pageSize: filters.pageSize,
  };
}

// One ticket for its detail page; null when the id is unknown.
export async function getSupportTicket(
  ticketId: string,
): Promise<SupportTicketView | null> {
  await requirePlatformAdmin();
  if (!z.uuid().safeParse(ticketId).success) return null;
  const ticket = await getDb().supportTicket.findUnique({
    where: { id: ticketId },
    select: ticketSelect,
  });
  return ticket && toView(ticket);
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

function ticketNotFound(): AppError {
  return new AppError("VALIDATION_ERROR", "This ticket could not be found.");
}

// A super admin opens a ticket on a clinic's behalf (or about the platform,
// with no clinic), e.g. after a phone call.
export async function adminCreateTicket(
  input: SupportTicketAdminCreate,
): Promise<SupportTicketView> {
  const admin = await requirePlatformAdmin();
  return getDb().$transaction(async (tx) => {
    if (
      input.clinicId &&
      !(await tx.clinic.findUnique({
        where: { id: input.clinicId },
        select: { id: true },
      }))
    ) {
      throw new AppError("VALIDATION_ERROR", "Choose a clinic from the list.");
    }
    const ticket = await tx.supportTicket.create({
      data: {
        clinicId: input.clinicId,
        createdByUserId: admin.userId,
        subject: input.subject,
        body: input.body,
        status: input.status,
      },
      select: ticketSelect,
    });
    await recordPlatformAudit(tx, {
      actorUserId: admin.userId,
      action: "support_ticket.created",
      targetType: "support_ticket",
      targetId: ticket.id,
      metadata: { status: input.status },
    });
    return toView(ticket);
  });
}

export async function adminUpdateTicket(
  ticketId: string,
  input: SupportTicketEdit,
): Promise<SupportTicketView> {
  const admin = await requirePlatformAdmin();
  if (!z.uuid().safeParse(ticketId).success) throw ticketNotFound();
  return getDb().$transaction(async (tx) => {
    const ticket = await tx.supportTicket.findUnique({
      where: { id: ticketId },
      select: { subject: true, body: true, status: true },
    });
    if (!ticket) throw ticketNotFound();
    const changed = (["subject", "body", "status"] as const).filter(
      (field) => ticket[field] !== input[field],
    );
    const updated = await tx.supportTicket.update({
      where: { id: ticketId },
      data: { subject: input.subject, body: input.body, status: input.status },
      select: ticketSelect,
    });
    if (changed.length > 0) {
      await recordPlatformAudit(tx, {
        actorUserId: admin.userId,
        action: "support_ticket.updated",
        targetType: "support_ticket",
        targetId: ticketId,
        metadata: {
          changed,
          ...(changed.includes("status") && {
            previousStatus: ticket.status,
            newStatus: input.status,
          }),
        },
      });
    }
    return toView(updated);
  });
}

export async function deleteTicket(ticketId: string): Promise<void> {
  const admin = await requirePlatformAdmin();
  if (!z.uuid().safeParse(ticketId).success) throw ticketNotFound();
  await getDb().$transaction(async (tx) => {
    const ticket = await tx.supportTicket.findUnique({
      where: { id: ticketId },
      select: { status: true },
    });
    if (!ticket) throw ticketNotFound();
    await tx.supportTicket.delete({ where: { id: ticketId } });
    await recordPlatformAudit(tx, {
      actorUserId: admin.userId,
      action: "support_ticket.deleted",
      targetType: "support_ticket",
      targetId: ticketId,
      metadata: { status: ticket.status },
    });
  });
}
