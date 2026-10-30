import { z } from "zod";
import { recordAudit } from "@/features/audit/record-audit";
import { clinicLogoUrl, setClinicLogo } from "@/features/clinics/logo";
import { WEEKDAYS } from "@/features/clinics/opening-hours";
import {
  hoursFromSimple,
  simpleFromHours,
  type SimpleHours,
} from "@/features/clinics/profile-fields";
import { acceptUrl } from "@/features/invitations/invitations";
import {
  hashInvitationToken,
  invitationExpiry,
  newInvitationToken,
} from "@/features/invitations/tokens";
import { enqueueOutboxEvent } from "@/features/notifications/events";
import { clinicSlugSchema } from "@/features/onboarding/slug";
import { Prisma } from "@/generated/prisma/client";
import type {
  ClinicStatus,
  ClinicType,
  MembershipRole,
  MembershipStatus,
} from "@/generated/prisma/enums";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { recordPlatformAudit } from "./audit";
import { pageWindow, type Paginated } from "./pagination";
import type { ClinicHours } from "./clinic-hours";
import type {
  ClinicCreateInput,
  ClinicDetailsInput,
  ClinicFilter,
} from "./schemas";
import {
  ACTIVATED_ACTION,
  SIGNED_UP_ACTION,
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
  timezone: string;
  address: string | null;
  phone: string | null;
  clinicType: ClinicType;
  email: string | null;
  city: string | null;
  state: string | null;
  pinCode: string | null;
  hours: ClinicHours;
  // Versioned URL of the uploaded logo, or null for the letter fallback.
  logoUrl: string | null;
  // Any queue token, ever. Such clinics can't be deleted or change address.
  hasPatientHistory: boolean;
};

export type ClinicDetail = ClinicRow & {
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
  timezone: true,
  address: true,
  phone: true,
  clinicType: true,
  email: true,
  city: true,
  state: true,
  pinCode: true,
  openingHours: true,
  logo: { select: { updatedAt: true } },
  _count: { select: { memberships: true, tokens: true } },
} as const;

type RowRecord = {
  id: string;
  name: string;
  slug: string;
  status: ClinicStatus;
  createdAt: Date;
  timezone: string;
  address: string | null;
  phone: string | null;
  clinicType: ClinicType;
  email: string | null;
  city: string | null;
  state: string | null;
  pinCode: string | null;
  openingHours: Prisma.JsonValue;
  logo: { updatedAt: Date } | null;
  _count: { memberships: number; tokens: number };
};

function hoursOf(stored: Prisma.JsonValue): ClinicHours {
  if (stored === null) return { kind: "none" };
  const simple = simpleFromHours(stored);
  return simple ? { kind: "simple", hours: simple } : { kind: "custom" };
}

function toRow(clinic: RowRecord, latestAction: string | null): ClinicRow {
  return {
    id: clinic.id,
    name: clinic.name,
    slug: clinic.slug,
    status: clinic.status,
    lifecycle: clinicLifecycle(clinic.status, latestAction),
    createdAt: clinic.createdAt.toISOString(),
    memberCount: clinic._count.memberships,
    timezone: clinic.timezone,
    address: clinic.address,
    phone: clinic.phone,
    clinicType: clinic.clinicType,
    email: clinic.email,
    city: clinic.city,
    state: clinic.state,
    pinCode: clinic.pinCode,
    hours: hoursOf(clinic.openingHours),
    logoUrl: clinic.logo && clinicLogoUrl(clinic.slug, clinic.logo.updatedAt),
    hasPatientHistory: clinic._count.tokens > 0,
  };
}

// Latest sign-up, approval or suspension per clinic, to tell pending from
// suspended. Other clinic events (edits, invitations) don't change that.
export async function latestClinicActions(
  clinicIds: readonly string[],
): Promise<Map<string, string>> {
  if (clinicIds.length === 0) return new Map();
  const events = await getDb().platformAuditEvent.findMany({
    where: {
      targetType: "clinic",
      targetId: { in: [...clinicIds] },
      action: { in: [SIGNED_UP_ACTION, ACTIVATED_ACTION, SUSPENDED_ACTION] },
    },
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

// One page of clinics, newest first (the id breaks ties). Pending and
// suspended clinics are both INACTIVE and told apart by their audit history,
// so for those two filters the matching ids are found first, then paged.
export async function listClinicsPage(filters: {
  search?: string;
  lifecycle?: ClinicFilter;
  page: number;
  pageSize: number;
}): Promise<Paginated<ClinicRow>> {
  await requirePlatformAdmin();
  const db = getDb();
  const search = filters.search?.trim();
  const where: Prisma.ClinicWhereInput = {
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
      ],
    }),
    ...(filters.lifecycle && {
      status: filters.lifecycle === "ACTIVE" ? "ACTIVE" : "INACTIVE",
    }),
  };
  const order = [{ createdAt: "desc" as const }, { id: "desc" as const }];

  let ids: string[] | null = null;
  if (filters.lifecycle && filters.lifecycle !== "ACTIVE") {
    const inactive = await db.clinic.findMany({
      where,
      orderBy: order,
      select: { id: true },
    });
    const latest = await latestClinicActions(inactive.map((c) => c.id));
    ids = inactive
      .filter(
        (c) =>
          clinicLifecycle("INACTIVE", latest.get(c.id) ?? null) ===
          filters.lifecycle,
      )
      .map((c) => c.id);
  }
  const total = ids ? ids.length : await db.clinic.count({ where });
  const { page, pageCount, skip } = pageWindow(
    filters.page,
    total,
    filters.pageSize,
  );
  const clinics = await db.clinic.findMany({
    where: ids
      ? { id: { in: ids.slice(skip, skip + filters.pageSize) } }
      : where,
    orderBy: order,
    ...(ids ? {} : { skip, take: filters.pageSize }),
    select: rowSelect,
  });
  const latest = await latestClinicActions(clinics.map((c) => c.id));
  return {
    rows: clinics.map((c) => toRow(c, latest.get(c.id) ?? null)),
    total,
    page,
    pageCount,
    pageSize: filters.pageSize,
  };
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

// ---- Add, edit and delete (super admins) ----

export const CREATED_ACTION = "clinic.created";
export const DELETED_ACTION = "clinic.deleted";

const SLUG_TAKEN = "That address is taken. Try another.";
export const PATIENT_HISTORY_MESSAGE =
  "This clinic has patient history. Suspend it instead.";
export const ADDRESS_FIXED_MESSAGE =
  "This clinic has served patients, so its address can't change: printed QR codes use it.";

function isPrismaError(error: unknown, code: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}

export type SlugCheck =
  { available: true } | { available: false; reason: string };

// For the add and edit forms. `exceptClinicId` lets a clinic keep its own slug.
export async function checkClinicSlug(
  slug: string,
  exceptClinicId?: string,
): Promise<SlugCheck> {
  await requirePlatformAdmin();
  const parsed = clinicSlugSchema.safeParse(slug);
  if (!parsed.success) {
    return { available: false, reason: parsed.error.issues[0].message };
  }
  const existing = await getDb().clinic.findUnique({
    where: { slug: parsed.data },
    select: { id: true },
  });
  return existing && existing.id !== exceptClinicId
    ? { available: false, reason: SLUG_TAKEN }
    : { available: true };
}

// The clinic columns both forms set directly (hours and logo aside).
function profileData(input: ClinicDetailsInput | ClinicCreateInput) {
  return {
    name: input.name,
    slug: input.slug,
    timezone: input.timezone,
    status: input.status,
    phone: input.phone,
    address: input.address,
    clinicType: input.clinicType,
    email: input.email,
    city: input.city,
    state: input.state,
    pinCode: input.pinCode,
  };
}

export type ClinicCreateResult = {
  clinicId: string;
  slug: string;
  // A new email gets an invitation (link shown once); an existing account is
  // added to the clinic straight away.
  admin:
    | { kind: "invited"; email: string; acceptUrl: string }
    | { kind: "added"; email: string };
};

// Creates a clinic with its profile, hours and logo, its first service and
// its first admin, all or nothing. A clinic added active is approved by
// being added; one added inactive shows as suspended until activated.
export async function createClinic(
  input: ClinicCreateInput,
  now: Date = new Date(),
): Promise<ClinicCreateResult> {
  const admin = await requirePlatformAdmin();
  const token = newInvitationToken();
  const link = acceptUrl(token);
  const expiresAt = invitationExpiry(now);

  try {
    return await getDb().$transaction(async (tx) => {
      if (
        await tx.clinic.findUnique({
          where: { slug: input.slug },
          select: { id: true },
        })
      ) {
        throw new AppError("VALIDATION_ERROR", SLUG_TAKEN);
      }

      const clinic = await tx.clinic.create({
        data: {
          ...profileData(input),
          openingHours: hoursFromSimple(input.hours),
        },
        select: { id: true, name: true, slug: true },
      });
      if (input.logo) await setClinicLogo(tx, clinic.id, input.logo);
      await tx.service.create({
        data: {
          clinicId: clinic.id,
          name: input.serviceName,
          tokenPrefix: input.tokenPrefix,
        },
      });
      const existingUser = await tx.user.findUnique({
        where: { email: input.adminEmail },
        select: { id: true },
      });
      let result: ClinicCreateResult["admin"];
      if (existingUser) {
        await tx.clinicMembership.create({
          data: {
            clinicId: clinic.id,
            userId: existingUser.id,
            role: "CLINIC_ADMIN",
          },
        });
        result = { kind: "added", email: input.adminEmail };
      } else {
        // Only the token's hash is stored; the link is shown once and emailed.
        const invitation = await tx.staffInvitation.create({
          data: {
            clinicId: clinic.id,
            email: input.adminEmail,
            name: input.adminName,
            role: "CLINIC_ADMIN",
            tokenHash: hashInvitationToken(token),
            invitedByUserId: admin.userId,
            expiresAt,
          },
          select: { id: true },
        });
        await enqueueOutboxEvent(tx, "staff.invited", invitation.id, {
          invitationId: invitation.id,
          email: input.adminEmail,
          name: input.adminName,
          clinicName: clinic.name,
          role: "CLINIC_ADMIN",
          acceptUrl: link,
          expiresAt: expiresAt.toISOString(),
        });
        await recordAudit(tx, {
          clinicId: clinic.id,
          actorUserId: admin.userId,
          action: "staff.invited",
          newState: "CLINIC_ADMIN",
          metadata: { invitationId: invitation.id },
        });
        result = { kind: "invited", email: input.adminEmail, acceptUrl: link };
      }

      await recordPlatformAudit(tx, {
        actorUserId: admin.userId,
        action: CREATED_ACTION,
        targetType: "clinic",
        targetId: clinic.id,
        metadata: { name: clinic.name, slug: clinic.slug, admin: result.kind },
      });
      return { clinicId: clinic.id, slug: clinic.slug, admin: result };
    });
  } catch (error) {
    // Two admins racing for the same address.
    if (isPrismaError(error, "P2002")) {
      throw new AppError("VALIDATION_ERROR", SLUG_TAKEN);
    }
    throw error;
  }
}

const EDITABLE_FIELDS = [
  "name",
  "slug",
  "timezone",
  "status",
  "phone",
  "address",
  "clinicType",
  "email",
  "city",
  "state",
  "pinCode",
] as const satisfies readonly (keyof ClinicDetailsInput)[];

// Stored hours (jsonb, so key order isn't kept) against the form's.
function sameHours(stored: Prisma.JsonValue, next: SimpleHours): boolean {
  const current = simpleFromHours(stored);
  if (!current) return false;
  const days = (hours: SimpleHours) =>
    WEEKDAYS.filter((day) => hours.workingDays.includes(day)).join(",");
  return (
    current.openingTime === next.openingTime &&
    current.closingTime === next.closingTime &&
    days(current) === days(next)
  );
}

export async function updateClinic(
  clinicId: string,
  input: ClinicDetailsInput,
): Promise<void> {
  const admin = await requirePlatformAdmin();
  if (!z.uuid().safeParse(clinicId).success) throw clinicNotFound();
  try {
    await getDb().$transaction(async (tx) => {
      const clinic = await tx.clinic.findUnique({
        where: { id: clinicId },
        select: {
          name: true,
          slug: true,
          timezone: true,
          status: true,
          phone: true,
          address: true,
          clinicType: true,
          email: true,
          city: true,
          state: true,
          pinCode: true,
          openingHours: true,
          logo: { select: { clinicId: true } },
          _count: { select: { tokens: true } },
        },
      });
      if (!clinic) throw clinicNotFound();
      const changed: string[] = EDITABLE_FIELDS.filter(
        (field) => clinic[field] !== input[field],
      );
      // Null hours keep custom hours; the same simple hours are no change.
      const hoursChanged =
        input.hours !== null && !sameHours(clinic.openingHours, input.hours);
      if (hoursChanged) changed.push("openingHours");
      const logoChanged =
        input.logo !== undefined && (input.logo !== null || !!clinic.logo);
      if (logoChanged) changed.push("logo");
      if (changed.length === 0) return;

      if (changed.includes("slug")) {
        if (clinic._count.tokens > 0) {
          throw new AppError("INVALID_STATE_TRANSITION", ADDRESS_FIXED_MESSAGE);
        }
        const taken = await tx.clinic.findUnique({
          where: { slug: input.slug },
          select: { id: true },
        });
        if (taken) throw new AppError("VALIDATION_ERROR", SLUG_TAKEN);
      }
      await tx.clinic.update({
        where: { id: clinicId },
        data: {
          ...profileData(input),
          ...(hoursChanged &&
            input.hours && { openingHours: hoursFromSimple(input.hours) }),
        },
      });
      if (logoChanged) await setClinicLogo(tx, clinicId, input.logo ?? null);
      await recordPlatformAudit(tx, {
        actorUserId: admin.userId,
        action: "clinic.updated",
        targetType: "clinic",
        targetId: clinicId,
        metadata: {
          changed,
          ...(changed.includes("slug") && {
            previousSlug: clinic.slug,
            newSlug: input.slug,
          }),
        },
      });
      // A status change approves or suspends, as the status button does.
      if (changed.includes("status")) {
        await recordPlatformAudit(tx, {
          actorUserId: admin.userId,
          action:
            input.status === "ACTIVE" ? ACTIVATED_ACTION : SUSPENDED_ACTION,
          targetType: "clinic",
          targetId: clinicId,
          metadata: { previousStatus: clinic.status, newStatus: input.status },
        });
      }
    });
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      throw new AppError("VALIDATION_ERROR", SLUG_TAKEN);
    }
    throw error;
  }
}

// Safe delete: only a clinic that has never had a queue token (a test or
// duplicate clinic) is removed, with everything that hangs off it. A clinic
// with patient history can only be suspended. Staff left without any clinic
// are deactivated, not deleted; support tickets stay, without the clinic.
export async function deleteClinic(
  clinicId: string,
  confirmSlug: string,
): Promise<{ deactivatedUsers: number }> {
  const admin = await requirePlatformAdmin();
  if (!z.uuid().safeParse(clinicId).success) throw clinicNotFound();
  try {
    return await getDb().$transaction(async (tx) => {
      const clinic = await tx.clinic.findUnique({
        where: { id: clinicId },
        select: {
          name: true,
          slug: true,
          _count: { select: { tokens: true } },
        },
      });
      if (!clinic) throw clinicNotFound();
      if (confirmSlug.trim().toLowerCase() !== clinic.slug) {
        throw new AppError(
          "VALIDATION_ERROR",
          `Type the clinic's address, ${clinic.slug}, to confirm.`,
        );
      }
      if (clinic._count.tokens > 0) {
        throw new AppError("INVALID_STATE_TRANSITION", PATIENT_HISTORY_MESSAGE);
      }

      const queues = await tx.queue.findMany({
        where: { clinicId },
        select: { id: true },
      });
      if (queues.length > 0) {
        await tx.idempotencyRecord.deleteMany({
          where: {
            OR: queues.map((queue) => ({
              scope: { startsWith: `queue:${queue.id}:` },
            })),
          },
        });
      }
      // Unsent invitation emails would point at a clinic that's gone.
      const invitations = await tx.staffInvitation.findMany({
        where: { clinicId },
        select: { id: true },
      });
      if (invitations.length > 0) {
        await tx.outboxEvent.deleteMany({
          where: {
            eventType: "staff.invited",
            processedAt: null,
            aggregateId: { in: invitations.map((row) => row.id) },
          },
        });
      }
      const members = await tx.clinicMembership.findMany({
        where: { clinicId },
        select: { userId: true },
      });

      await tx.auditEvent.deleteMany({ where: { clinicId } });
      await tx.queue.deleteMany({ where: { clinicId } });
      // Service assignments go with their services (cascade).
      await tx.service.deleteMany({ where: { clinicId } });
      await tx.clinicHoliday.deleteMany({ where: { clinicId } });
      await tx.staffInvitation.deleteMany({ where: { clinicId } });
      await tx.clinicMembership.deleteMany({ where: { clinicId } });
      await tx.supportTicket.updateMany({
        where: { clinicId },
        data: { clinicId: null },
      });
      // Any subscription row from before billing was removed cascades.
      await tx.clinic.delete({ where: { id: clinicId } });

      // Staff of this clinic only, never platform admins.
      const orphaned = await tx.user.findMany({
        where: {
          id: { in: members.map((member) => member.userId) },
          memberships: { none: {} },
          platformRole: null,
          status: "ACTIVE",
        },
        select: { id: true },
      });
      const orphanIds = orphaned.map((user) => user.id);
      if (orphanIds.length > 0) {
        await tx.user.updateMany({
          where: { id: { in: orphanIds } },
          data: { status: "INACTIVE" },
        });
        await tx.session.deleteMany({ where: { userId: { in: orphanIds } } });
      }

      await recordPlatformAudit(tx, {
        actorUserId: admin.userId,
        action: DELETED_ACTION,
        targetType: "clinic",
        targetId: clinicId,
        metadata: {
          name: clinic.name,
          slug: clinic.slug,
          deactivatedUsers: orphanIds.length,
        },
      });
      return { deactivatedUsers: orphanIds.length };
    });
  } catch (error) {
    // A patient joined between the check and the delete.
    if (isPrismaError(error, "P2003")) {
      throw new AppError("INVALID_STATE_TRANSITION", PATIENT_HISTORY_MESSAGE);
    }
    throw error;
  }
}

// For the support ticket form's clinic picker.
export async function listClinicOptions(): Promise<
  { id: string; name: string }[]
> {
  await requirePlatformAdmin();
  return getDb().clinic.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
