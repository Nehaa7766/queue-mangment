import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AcceptInviteForm } from "@/components/admin/accept-invite-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { ROLE_LABELS } from "@/components/layout/staff-nav";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { lookupInvitation } from "@/features/invitations/invitations";
import { invitationTokenSchema } from "@/features/invitations/tokens";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Accept invitation · QueueCare",
  // The URL holds a one-time secret.
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function AcceptInvitePage({
  params,
}: PageProps<"/accept-invite/[token]">) {
  return (
    <Suspense
      fallback={
        <AuthShell title="Join your clinic">
          <Skeleton className="h-48 w-full" />
        </AuthShell>
      }
    >
      <AcceptInvite params={params} />
    </Suspense>
  );
}

const PROBLEMS = {
  invalid: {
    title: "This link doesn't work",
    description:
      "It may have been cancelled or mistyped. Ask your clinic admin for a new invitation.",
  },
  expired: {
    title: "This invitation has expired",
    description:
      "Invitations last 7 days. Ask your clinic admin to invite you again.",
  },
  used: {
    title: "This invitation was already used",
    description: "Your account is set up. Sign in with your email.",
  },
} as const;

async function AcceptInvite({
  params,
}: {
  params: PageProps<"/accept-invite/[token]">["params"];
}) {
  await connection();
  const { token } = await params;
  const parsed = invitationTokenSchema.safeParse(token);
  const valid = parsed.success ? parsed.data : null;
  const lookup = valid
    ? await lookupInvitation(valid)
    : ({ status: "invalid" } as const);

  if (!valid || lookup.status !== "valid") {
    const problem =
      PROBLEMS[lookup.status === "valid" ? "invalid" : lookup.status];
    return (
      <AuthShell title={problem.title} description={problem.description}>
        <Link
          href="/login"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-11 rounded-btn",
          )}
        >
          Go to sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Join your clinic"
      description={`${lookup.clinicName} invited you as ${ROLE_LABELS[lookup.role].toLowerCase()}.`}
    >
      <AcceptInviteForm
        token={valid}
        initialName={lookup.name}
        email={lookup.email}
        hasAccount={lookup.hasAccount}
      />
    </AuthShell>
  );
}
