import { z } from "zod";
import type { MembershipRole } from "@/generated/prisma/enums";
import { MEMBERSHIP_ROLES, passwordSchema } from "@/features/staff/schemas";

// Shared by the API and the invitation forms. No server imports: the browser
// loads this.

export const invitationInputSchema = z.object({
  name: z.string().trim().min(2, "Enter their name.").max(80),
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  role: z.enum(MEMBERSHIP_ROLES),
});
export type InvitationInput = z.infer<typeof invitationInputSchema>;

export const acceptInvitationSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80),
  // Only for new accounts; someone who already has an account keeps theirs.
  password: passwordSchema.optional(),
});
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

export type PendingInvitationView = {
  id: string;
  name: string;
  email: string;
  role: MembershipRole;
  expiresAt: string;
  expired: boolean;
};

export type InvitationLookup =
  | {
      status: "valid";
      clinicName: string;
      name: string;
      email: string;
      role: MembershipRole;
      expiresAt: string;
      // Someone who already has an account keeps their password.
      hasAccount: boolean;
    }
  | { status: "invalid" | "expired" | "used" };
