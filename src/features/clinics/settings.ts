import { Prisma } from "@/generated/prisma/client";
import type { NoShowAction } from "@/generated/prisma/enums";
import { recordAudit } from "@/features/audit/record-audit";
import { getDb } from "@/lib/db";
import { clinicNotFound, requireClinicAdminAccess } from "./access";
import { openingHoursSchema, type OpeningHours } from "./opening-hours";
import type { SettingsUpdate } from "./schemas";

export type ClinicSettingsView = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  address: string | null;
  phone: string | null;
  // Null means no hours are set: the clinic counts as always open.
  openingHours: OpeningHours | null;
  queue: {
    waitTargetMinutes: number;
    gracePeriodSeconds: number;
    maxQueueSize: number | null;
    noShowAction: NoShowAction;
    allowRequeue: boolean;
    patientDataRetentionDays: number;
  };
};

const settingsSelect = {
  id: true,
  name: true,
  slug: true,
  timezone: true,
  address: true,
  phone: true,
  openingHours: true,
  waitTargetMinutes: true,
  gracePeriodSeconds: true,
  maxQueueSize: true,
  noShowAction: true,
  allowRequeue: true,
  patientDataRetentionDays: true,
} as const;

export async function getClinicSettings(
  clinicId: string,
): Promise<ClinicSettingsView> {
  await requireClinicAdminAccess(clinicId, "clinic.settings");
  const clinic = await getDb().clinic.findUnique({
    where: { id: clinicId },
    select: settingsSelect,
  });
  if (!clinic) throw clinicNotFound();
  // Hours saved before this editor existed may not validate; show them as unset.
  const hours = openingHoursSchema.safeParse(clinic.openingHours);
  return {
    id: clinic.id,
    name: clinic.name,
    slug: clinic.slug,
    timezone: clinic.timezone,
    address: clinic.address,
    phone: clinic.phone,
    openingHours: hours.success ? hours.data : null,
    queue: {
      waitTargetMinutes: clinic.waitTargetMinutes,
      gracePeriodSeconds: clinic.gracePeriodSeconds,
      maxQueueSize: clinic.maxQueueSize,
      noShowAction: clinic.noShowAction,
      allowRequeue: clinic.allowRequeue,
      patientDataRetentionDays: clinic.patientDataRetentionDays,
    },
  };
}

const AUDIT_ACTIONS: Record<SettingsUpdate["section"], string> = {
  profile: "clinic.profile_updated",
  queue: "clinic.queue_settings_updated",
  hours: "clinic.hours_updated",
};

// Saves one section of the settings page. The audit row lists the fields
// that changed, never patient data.
export async function updateClinicSettings(
  clinicId: string,
  update: SettingsUpdate,
): Promise<ClinicSettingsView> {
  const access = await requireClinicAdminAccess(clinicId, "clinic.settings");
  // Plain values for the audit diff; the hours column needs DbNull to clear.
  const values =
    update.section === "hours"
      ? { openingHours: update.openingHours }
      : sectionValues(update);
  const data: Prisma.ClinicUpdateInput =
    update.section === "hours"
      ? // Prisma.DbNull writes SQL NULL into the JSON column.
        { openingHours: update.openingHours ?? Prisma.DbNull }
      : sectionValues(update);

  await getDb().$transaction(async (tx) => {
    const before = await tx.clinic.findUniqueOrThrow({
      where: { id: clinicId },
      select: settingsSelect,
    });
    await tx.clinic.update({ where: { id: clinicId }, data });
    await recordAudit(tx, {
      clinicId,
      actorUserId: access.user.userId,
      action: AUDIT_ACTIONS[update.section],
      metadata: { changed: changedFields(before, values) },
    });
  });

  return getClinicSettings(clinicId);
}

function sectionValues(update: Exclude<SettingsUpdate, { section: "hours" }>) {
  switch (update.section) {
    case "profile":
      return {
        name: update.name,
        address: update.address,
        phone: update.phone,
        timezone: update.timezone,
      };
    case "queue":
      return {
        waitTargetMinutes: update.waitTargetMinutes,
        gracePeriodSeconds: update.gracePeriodSeconds,
        maxQueueSize: update.maxQueueSize,
        noShowAction: update.noShowAction,
        allowRequeue: update.allowRequeue,
        patientDataRetentionDays: update.patientDataRetentionDays,
      };
  }
}

function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): string[] {
  return Object.keys(after).filter(
    (key) =>
      JSON.stringify(before[key] ?? null) !==
      JSON.stringify(after[key] ?? null),
  );
}
