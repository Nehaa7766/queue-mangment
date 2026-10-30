import { hashPassword } from "better-auth/crypto";
import type { Prisma } from "@/generated/prisma/client";

// Public sign-up is off, so staff passwords are set here: Better Auth's own
// scrypt hash on the user's "credential" account, exactly as sign-in reads it
// (accountId is the user's id). Hash before opening the transaction; scrypt
// is deliberately slow.
export function hashStaffPassword(password: string): Promise<string> {
  return hashPassword(password);
}

export async function saveCredentialPassword(
  tx: Prisma.TransactionClient,
  userId: string,
  passwordHash: string,
): Promise<void> {
  await tx.account.upsert({
    where: {
      providerId_accountId: { providerId: "credential", accountId: userId },
    },
    create: {
      userId,
      accountId: userId,
      providerId: "credential",
      password: passwordHash,
    },
    update: { password: passwordHash },
  });
}
