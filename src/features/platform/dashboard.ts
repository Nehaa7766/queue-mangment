import { requirePlatformAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { listClinics, type ClinicRow } from "./clinics";

export type PlatformDashboard = {
  clinics: {
    active: number;
    pending: number;
    suspended: number;
    total: number;
  };
  // Open or in progress; `inProgress` is the part someone is working on.
  openTickets: number;
  ticketsInProgress: number;
};

export async function getPlatformDashboard(): Promise<PlatformDashboard> {
  await requirePlatformAdmin();
  const db = getDb();
  const [clinics, ticketCounts] = await Promise.all([
    listClinics({}),
    db.supportTicket.groupBy({
      by: ["status"],
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      _count: { _all: true },
    }),
  ]);
  const count = (lifecycle: ClinicRow["lifecycle"]) =>
    clinics.filter((clinic) => clinic.lifecycle === lifecycle).length;
  const tickets = (status: "OPEN" | "IN_PROGRESS") =>
    ticketCounts.find((row) => row.status === status)?._count._all ?? 0;
  return {
    clinics: {
      active: count("ACTIVE"),
      pending: count("PENDING"),
      suspended: count("SUSPENDED"),
      total: clinics.length,
    },
    openTickets: tickets("OPEN") + tickets("IN_PROGRESS"),
    ticketsInProgress: tickets("IN_PROGRESS"),
  };
}
