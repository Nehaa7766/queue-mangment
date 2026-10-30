import { z } from "zod";
import type {
  ClinicStatus,
  SubscriptionStatus,
} from "@/generated/prisma/enums";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { recordPlatformAudit } from "./audit";
import { type BillableSubscription } from "./billing";
import { clinicNotFound } from "./clinics";
import type { SubscriptionUpdate } from "./schemas";

export type PlanOption = {
  id: string;
  code: string;
  name: string;
  priceMonthlyMinor: number;
  currency: string;
  isActive: boolean;
};

export type SubscriptionRow = {
  clinicId: string;
  clinicName: string;
  clinicSlug: string;
  clinicStatus: ClinicStatus;
  subscription: {
    status: SubscriptionStatus;
    planId: string;
    planName: string;
    priceMonthlyMinor: number;
    currency: string;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
  } | null;
};

function toDateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function fromDateOnly(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

const subscriptionSelect = {
  status: true,
  planId: true,
  trialEndsAt: true,
  currentPeriodEnd: true,
  plan: { select: { name: true, priceMonthlyMinor: true, currency: true } },
} as const;

type SubscriptionRecord = {
  status: SubscriptionStatus;
  planId: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  plan: { name: string; priceMonthlyMinor: number; currency: string };
} | null;

function toSubscription(
  subscription: SubscriptionRecord,
): SubscriptionRow["subscription"] {
  return (
    subscription && {
      status: subscription.status,
      planId: subscription.planId,
      planName: subscription.plan.name,
      priceMonthlyMinor: subscription.plan.priceMonthlyMinor,
      currency: subscription.plan.currency,
      trialEndsAt: toDateOnly(subscription.trialEndsAt),
      currentPeriodEnd: toDateOnly(subscription.currentPeriodEnd),
    }
  );
}

// Every clinic, with or without a subscription, so gaps are visible.
export async function listSubscriptions(): Promise<SubscriptionRow[]> {
  await requirePlatformAdmin();
  const clinics = await getDb().clinic.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      subscription: { select: subscriptionSelect },
    },
  });
  return clinics.map((clinic) => ({
    clinicId: clinic.id,
    clinicName: clinic.name,
    clinicSlug: clinic.slug,
    clinicStatus: clinic.status,
    subscription: toSubscription(clinic.subscription),
  }));
}

export async function listPlans(): Promise<PlanOption[]> {
  await requirePlatformAdmin();
  return getDb().plan.findMany({
    orderBy: [{ isActive: "desc" }, { priceMonthlyMinor: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      priceMonthlyMinor: true,
      currency: true,
      isActive: true,
    },
  });
}

export async function getSubscriptionEditor(clinicId: string): Promise<{
  row: SubscriptionRow;
  plans: PlanOption[];
} | null> {
  await requirePlatformAdmin();
  if (!z.uuid().safeParse(clinicId).success) return null;
  const clinic = await getDb().clinic.findUnique({
    where: { id: clinicId },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      subscription: { select: subscriptionSelect },
    },
  });
  if (!clinic) return null;
  return {
    row: {
      clinicId: clinic.id,
      clinicName: clinic.name,
      clinicSlug: clinic.slug,
      clinicStatus: clinic.status,
      subscription: toSubscription(clinic.subscription),
    },
    plans: await listPlans(),
  };
}

// Creates the subscription if the clinic has none. Managed by hand until a
// payment provider is chosen (docs/COMMERCIAL.md).
export async function updateSubscription(
  clinicId: string,
  update: SubscriptionUpdate,
): Promise<void> {
  const admin = await requirePlatformAdmin();
  if (!z.uuid().safeParse(clinicId).success) throw clinicNotFound();
  await getDb().$transaction(async (tx) => {
    const clinic = await tx.clinic.findUnique({
      where: { id: clinicId },
      select: { id: true, subscription: { select: subscriptionSelect } },
    });
    if (!clinic) throw clinicNotFound();
    const plan = await tx.plan.findUnique({
      where: { id: update.planId },
      select: { id: true },
    });
    if (!plan) {
      throw new AppError("VALIDATION_ERROR", "Choose a plan from the list.");
    }

    const data = {
      planId: update.planId,
      status: update.status,
      trialEndsAt: fromDateOnly(update.trialEndsAt),
      currentPeriodEnd: fromDateOnly(update.currentPeriodEnd),
    };
    const saved = await tx.subscription.upsert({
      where: { clinicId },
      create: { clinicId, ...data },
      update: data,
      select: { id: true },
    });
    const before = toSubscription(clinic.subscription);
    await recordPlatformAudit(tx, {
      actorUserId: admin.userId,
      action: before ? "subscription.updated" : "subscription.created",
      targetType: "subscription",
      targetId: saved.id,
      metadata: {
        clinicId,
        before: before && {
          planId: before.planId,
          status: before.status,
          trialEndsAt: before.trialEndsAt,
          currentPeriodEnd: before.currentPeriodEnd,
        },
        after: update,
      },
    });
  });
}

export async function listBillableSubscriptions(): Promise<
  (BillableSubscription & { planName: string; planId: string })[]
> {
  await requirePlatformAdmin();
  const subscriptions = await getDb().subscription.findMany({
    select: {
      status: true,
      plan: {
        select: {
          id: true,
          name: true,
          priceMonthlyMinor: true,
          currency: true,
        },
      },
    },
  });
  return subscriptions.map((s) => ({
    status: s.status,
    plan: {
      priceMonthlyMinor: s.plan.priceMonthlyMinor,
      currency: s.plan.currency,
    },
    planName: s.plan.name,
    planId: s.plan.id,
  }));
}
