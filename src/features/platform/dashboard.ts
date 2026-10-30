import { requirePlatformAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { listPlatformActivity, type PlatformActivity } from "./activity";
import { summarizeRevenue, type RevenueSummary } from "./billing";
import { listClinics, type ClinicRow } from "./clinics";
import { listBillableSubscriptions } from "./subscriptions";

export type PlatformDashboard = {
  clinics: { active: number; pending: number; suspended: number };
  pendingClinics: ClinicRow[];
  revenue: RevenueSummary[];
  openTickets: number;
  recentActivity: PlatformActivity[];
};

export async function getPlatformDashboard(): Promise<PlatformDashboard> {
  await requirePlatformAdmin();
  const [clinics, subscriptions, openTickets, recentActivity] =
    await Promise.all([
      listClinics({}),
      listBillableSubscriptions(),
      getDb().supportTicket.count({
        where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      }),
      listPlatformActivity({ limit: 8 }),
    ]);
  const count = (lifecycle: ClinicRow["lifecycle"]) =>
    clinics.filter((clinic) => clinic.lifecycle === lifecycle).length;
  return {
    clinics: {
      active: count("ACTIVE"),
      pending: count("PENDING"),
      suspended: count("SUSPENDED"),
    },
    pendingClinics: clinics.filter((clinic) => clinic.lifecycle === "PENDING"),
    revenue: summarizeRevenue(subscriptions),
    openTickets,
    recentActivity,
  };
}
