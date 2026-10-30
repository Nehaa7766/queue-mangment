import { z } from "zod";
import type {
  DoctorAvailability,
  MembershipRole,
  MembershipStatus,
} from "@/generated/prisma/enums";

// Shared by the API and the admin forms. No server imports: the browser loads this.

// Same limits as Better Auth's email and password sign-in.
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(128, "Use at most 128 characters.");

export const MEMBERSHIP_ROLES = [
  "RECEPTIONIST",
  "DOCTOR",
  "CLINIC_ADMIN",
] as const satisfies readonly MembershipRole[];

export const memberUpdateSchema = z
  .object({
    role: z.enum(MEMBERSHIP_ROLES).optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  })
  .refine((value) => value.role || value.status, "Nothing to change.");
export type MemberUpdate = z.infer<typeof memberUpdateSchema>;

export const passwordResetSchema = z.object({ password: passwordSchema });

export const doctorServicesSchema = z.object({
  serviceIds: z.array(z.uuid()).max(50),
});

export type StaffMemberView = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: MembershipRole;
  status: MembershipStatus;
  isYou: boolean;
  // Doctors only.
  availability: DoctorAvailability;
  delayMinutes: number;
  serviceIds: string[];
};
