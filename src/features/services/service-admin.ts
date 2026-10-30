import { Prisma } from "@/generated/prisma/client";
import { recordAudit } from "@/features/audit/record-audit";
import { requireClinicAdminAccess } from "@/features/clinics/access";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import type { AdminServiceView, ServiceInput, ServiceUpdate } from "./schemas";

export {
  serviceInputSchema,
  serviceUpdateSchema,
  type AdminServiceView,
  type ServiceInput,
  type ServiceUpdate,
} from "./schemas";

// Service management for clinic admins (docs/PHASES.md Phase 7). Services are
// soft-disabled, never deleted, so past tokens and analytics stay intact.

const serviceSelect = {
  id: true,
  name: true,
  description: true,
  tokenPrefix: true,
  estimatedDurationMinutes: true,
  isActive: true,
  _count: { select: { assignments: true, tokens: true } },
} satisfies Prisma.ServiceSelect;

type ServiceRow = Prisma.ServiceGetPayload<{ select: typeof serviceSelect }>;

function toView(row: ServiceRow): AdminServiceView {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    tokenPrefix: row.tokenPrefix,
    estimatedDurationMinutes: row.estimatedDurationMinutes,
    isActive: row.isActive,
    doctorCount: row._count.assignments,
    totalTokens: row._count.tokens,
  };
}

export async function listServices(
  clinicId: string,
): Promise<AdminServiceView[]> {
  await requireClinicAdminAccess(clinicId, "services.manage");
  const rows = await getDb().service.findMany({
    where: { clinicId },
    // Active first, then by prefix, matching the order patients see.
    orderBy: [{ isActive: "desc" }, { tokenPrefix: "asc" }],
    select: serviceSelect,
  });
  return rows.map(toView);
}

export async function createService(
  clinicId: string,
  input: ServiceInput,
): Promise<AdminServiceView> {
  const access = await requireClinicAdminAccess(clinicId, "services.manage");
  const row = await withUniqueMessages(() =>
    getDb().$transaction(async (tx) => {
      await assertUnique(tx, clinicId, input);
      const created = await tx.service.create({
        data: { clinicId, ...input },
        select: serviceSelect,
      });
      await recordAudit(tx, {
        clinicId,
        actorUserId: access.user.userId,
        action: "service.created",
        metadata: { serviceId: created.id, tokenPrefix: created.tokenPrefix },
      });
      return created;
    }),
  );
  return toView(row);
}

export async function updateService(
  serviceId: string,
  update: ServiceUpdate,
): Promise<AdminServiceView> {
  const db = getDb();
  const existing = await db.service.findUnique({
    where: { id: serviceId },
    select: { id: true, clinicId: true, isActive: true },
  });
  if (!existing) throw serviceNotFound();
  const access = await requireClinicAdminAccess(
    existing.clinicId,
    "services.manage",
  );

  const row = await withUniqueMessages(() =>
    db.$transaction(async (tx) => {
      await assertUnique(tx, existing.clinicId, update, serviceId);
      const updated = await tx.service.update({
        where: { id: serviceId },
        data: update,
        select: serviceSelect,
      });
      await recordAudit(tx, {
        clinicId: existing.clinicId,
        actorUserId: access.user.userId,
        action: auditAction(existing.isActive, update.isActive),
        metadata: {
          serviceId,
          changed: Object.keys(update).filter(
            (key) => update[key as keyof ServiceUpdate] !== undefined,
          ),
        },
      });
      return updated;
    }),
  );
  return toView(row);
}

function auditAction(wasActive: boolean, isActive: boolean | undefined) {
  if (isActive === false && wasActive) return "service.disabled";
  if (isActive === true && !wasActive) return "service.enabled";
  return "service.updated";
}

export function serviceNotFound(): AppError {
  return new AppError("VALIDATION_ERROR", "This service no longer exists.");
}

// Services are unique per clinic by name and by token prefix. Checked first
// for a clear message; the unique indexes still catch a race.
async function assertUnique(
  tx: Prisma.TransactionClient,
  clinicId: string,
  input: { name?: string; tokenPrefix?: string },
  excludeId?: string,
): Promise<void> {
  if (!input.tokenPrefix && !input.name) return;
  const clash = await tx.service.findFirst({
    where: {
      clinicId,
      id: excludeId ? { not: excludeId } : undefined,
      OR: [
        ...(input.tokenPrefix ? [{ tokenPrefix: input.tokenPrefix }] : []),
        ...(input.name ? [{ name: input.name }] : []),
      ],
    },
    select: { name: true, tokenPrefix: true },
  });
  if (!clash) return;
  throw new AppError(
    "VALIDATION_ERROR",
    clash.tokenPrefix === input.tokenPrefix
      ? `${clash.name} already uses the prefix ${clash.tokenPrefix}.`
      : `Another service is already called ${clash.name}.`,
  );
}

async function withUniqueMessages<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = JSON.stringify(error.meta ?? {});
      throw new AppError(
        "VALIDATION_ERROR",
        target.includes("token_prefix") || target.includes("tokenPrefix")
          ? "Another service already uses that token prefix."
          : "Another service already has that name.",
      );
    }
    throw error;
  }
}
