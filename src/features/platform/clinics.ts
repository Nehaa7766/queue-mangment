import { z } from "zod";
import type {
  ClinicStatus,
  MembershipRole,
  MembershipStatus,
  SubscriptionStatus,
} from "@/generated/prisma/enums";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { recordPlatformAudit } from "./audit";
import type { ClinicFilter } from "./schemas";
import {
  ACTIVATED_ACTION,
  SUSPENDED_ACTION,
  clinicLifecycle,
  type ClinicLifecycle,
} from "./lifecycle";

const LIST_LIMIT = 200;

export type ClinicRow = {
  id: string;
  name: string;
  slug: string;
  status: ClinicStatus;
  lifecycle: ClinicLifecycle;
  createdAt: string;
  memberCount: number;
  subscription: {
    status: SubscriptionStatus;
    planName: string;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
  } | null;
};

export type ClinicDetail = ClinicRow & {
  timezone: string;
  address: string | null;
  phone: string | null;
  services: {
    id: string;
    name: string;
    tokenPrefix: string;
    isActive: boolean;
  }[];
  members: {
    userId: string;
    name: string;
    email: string;
    role: MembershipRole;
    status: MembershipStatus;
  }[];
};

export function clinicNotFound(): AppError {
  return new AppError("CLINIC_NOT_FOUND", "This clinic could not be found.");
}

const rowSelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
  createdAt: true,
  _count: { select: { memberships: true } },
  subscription: {
    select: {
      status: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
      plan: { select: { name: true } },
    },
  },
} as const;

type RowRecord = {
  id: string;
  name: string;
  slug: string;
  status: ClinicStatus;
  createdAt: Date;
  _count: { memberships: number };
  subscription: {
    status: SubscriptionStatus;
    trialEndsAt: Date | null;
    currentPeriodEnd: Date | null;
    plan: { name: string };
  } | null;
};

function toRow(clinic: RowRecord, latestAction: string | null): ClinicRow {
  return {
    id: clinic.id,
    name: clinic.name,
    slug: clinic.slug,
    status: clinic.status,
    lifecycle: clinicLifecycle(clinic.status, latestAction),
    createdAt: clinic.createdAt.toISOString(),
    memberCount: clinic._count.memberships,
    subscription: clinic.subscription && {
      status: clinic.subscription.status,
      planName: clinic.subscription.plan.name,
      trialEndsAt: clinic.subscription.trialEndsAt?.toISOString() ?? null,
      currentPeriodEnd:
        clinic.subscription.currentPeriodEnd?.toISOString() ?? null,
    },
  };
}

// Latest platform action per clinic, to tell pending from suspended.
export async function latestClinicActions(
  clinicIds: readonly string[],
): Promise<Map<string, string>> {
  if (clinicIds.length === 0) return new Map();
  const events = await getDb().platformAuditEvent.findMany({
    where: { targetType: "clinic", targetId: { in: [...clinicIds] } },
    orderBy: { createdAt: "desc" },
    select: { targetId: true, action: true },
  });
  const latest = new Map<string, string>();
  for (const event of events) {
    if (event.targetId && !latest.has(event.targetId)) {
      latest.set(event.targetId, event.action);
    }
  }
  return latest;
}

export async function listClinics(filters: {
  search?: string;
  lifecycle?: ClinicFilter;
}): Promise<ClinicRow[]> {
  await requirePlatformAdmin();
  const search = filters.search?.trim();
  const clinics = await getDb().clinic.findMany({
    where: {
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { slug: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(filters.lifecycle && {
        status: filters.lifecycle === "ACTIVE" ? "ACTIVE" : "INACTIVE",
      }),
    },
    orderBy: { createdAt: "desc" },
    take: LIST_LIMIT,
    select: rowSelect,
  });
  const latest = await latestClinicActions(clinics.map((c) => c.id));
  const rows = clinics.map((c) => toRow(c, latest.get(c.id) ?? null));
  return filters.lifecycle
    ? rows.filter((row) => row.lifecycle === filters.lifecycle)
    : rows;
}

export async function getClinicDetail(
  clinicId: string,
): Promise<ClinicDetail | null> {
  await requirePlatformAdmin();
  if (!z.uuid().safeParse(clinicId).success) return null;
  const clinic = await getDb().clinic.findUnique({
    where: { id: clinicId },
    select: {
      ...rowSelect,
      timezone: true,
      address: true,
      phone: true,
      services: {
        orderBy: { tokenPrefix: "asc" },
        select: { id: true, name: true, tokenPrefix: true, isActive: true },
      },
      memberships: {
        orderBy: { createdAt: "asc" },
        select: {
          role: true,
          status: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
  if (!clinic) return null;
  const latest = await latestClinicActions([clinic.id]);
  return {
    ...toRow(clinic, latest.get(clinic.id) ?? null),
    timezone: clinic.timezone,
    address: clinic.address,
    phone: clinic.phone,
    services: clinic.services,
    members: clinic.memberships.map((m) => ({
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      status: m.status,
    })),
  };
}

// Activating approves a pending clinic or lifts a suspension. Suspending
// blocks the public page and every staff screen (staff context needs an
// ACTIVE clinic) without deleting anything.
export async function setClinicStatus(
  clinicId: string,
  status: ClinicStatus,
): Promise<void> {
  const admin = await requirePlatformAdmin();
  if (!z.uuid().safeParse(clinicId).success) throw clinicNotFound();
  await getDb().$transaction(async (tx) => {
    const clinic = await tx.clinic.findUnique({
      where: { id: clinicId },
      select: { status: true },
    });
    if (!clinic) throw clinicNotFound();
    if (clinic.status === status) return;
    await tx.clinic.update({ where: { id: clinicId }, data: { status } });
    await recordPlatformAudit(tx, {
      actorUserId: admin.userId,
      action: status === "ACTIVE" ? ACTIVATED_ACTION : SUSPENDED_ACTION,
      targetType: "clinic",
      targetId: clinicId,
      metadata: { previousStatus: clinic.status, newStatus: status },
    });
  });
}
