import { hashPassword } from "better-auth/crypto";
import { Prisma } from "@/generated/prisma/client";
import { recordPlatformAudit } from "@/features/platform/audit";
import { SIGNED_UP_ACTION } from "@/features/platform/lifecycle";
import type { PlatformSettings } from "@/features/platform/settings";
import { getPlatformSettings } from "@/features/platform/settings-store";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import type { SignupInput } from "./signup-schema";
import { clinicSlugSchema } from "./slug";

export type SignupResult = {
  clinicId: string;
  clinicSlug: string;
  userId: string;
};

export type SlugAvailability =
  { available: true } | { available: false; reason: string };

const SLUG_TAKEN = "That address is taken. Try another.";
const EMAIL_TAKEN =
  "An account with this email already exists. Sign in instead, or use another email.";

export function assertSignupsOpen(settings: PlatformSettings): void {
  if (!settings.signupsEnabled) {
    throw new AppError(
      "FORBIDDEN",
      "New clinic sign-ups are closed right now. Please contact support.",
    );
  }
}

export async function checkSlugAvailability(
  slug: string,
): Promise<SlugAvailability> {
  const parsed = clinicSlugSchema.safeParse(slug);
  if (!parsed.success) {
    return { available: false, reason: parsed.error.issues[0].message };
  }
  const existing = await getDb().clinic.findUnique({
    where: { slug: parsed.data },
    select: { id: true },
  });
  return existing
    ? { available: false, reason: SLUG_TAKEN }
    : { available: true };
}

// Creates the clinic, its first service, and the admin's account and
// membership — all or nothing.
//
// Assumption until a platform admin process is agreed: new clinics start
// INACTIVE ("pending approval"). Their admin can't use staff screens and
// their public page stays hidden until a super admin activates them.
export async function signUpClinic(
  input: SignupInput,
  // Test hook: runs last inside the transaction, to prove rollback.
  options?: { beforeCommit?: (tx: Prisma.TransactionClient) => Promise<void> },
): Promise<SignupResult> {
  const settings = await getPlatformSettings();
  assertSignupsOpen(settings);
  // Hash outside the transaction: scrypt is deliberately slow.
  const passwordHash = await hashPassword(input.password);

  try {
    return await getDb().$transaction(async (tx) => {
      if (
        await tx.clinic.findUnique({
          where: { slug: input.clinicSlug },
          select: { id: true },
        })
      ) {
        throw new AppError("VALIDATION_ERROR", SLUG_TAKEN);
      }
      if (
        await tx.user.findUnique({
          where: { email: input.adminEmail },
          select: { id: true },
        })
      ) {
        throw new AppError("VALIDATION_ERROR", EMAIL_TAKEN);
      }

      const clinic = await tx.clinic.create({
        data: {
          name: input.clinicName,
          slug: input.clinicSlug,
          timezone: input.timezone,
          status: "INACTIVE",
        },
        select: { id: true, slug: true },
      });
      await tx.service.create({
        data: {
          clinicId: clinic.id,
          name: input.serviceName,
          tokenPrefix: input.tokenPrefix,
          estimatedDurationMinutes: input.serviceMinutes,
        },
      });
      const user = await tx.user.create({
        data: { name: input.adminName, email: input.adminEmail },
        select: { id: true },
      });
      // The same shape Better Auth writes for email and password sign-in.
      await tx.account.create({
        data: {
          userId: user.id,
          accountId: user.id,
          providerId: "credential",
          password: passwordHash,
        },
      });
      await tx.clinicMembership.create({
        data: { clinicId: clinic.id, userId: user.id, role: "CLINIC_ADMIN" },
      });
      await recordPlatformAudit(tx, {
        actorUserId: user.id,
        action: SIGNED_UP_ACTION,
        targetType: "clinic",
        targetId: clinic.id,
        metadata: { slug: clinic.slug },
      });

      await options?.beforeCommit?.(tx);
      return { clinicId: clinic.id, clinicSlug: clinic.slug, userId: user.id };
    });
  } catch (error) {
    // Two signups racing for the same slug or email.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(
        "VALIDATION_ERROR",
        "That address or email was just taken. Check both and try again.",
      );
    }
    throw error;
  }
}
