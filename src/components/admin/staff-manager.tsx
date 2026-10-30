"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ROLE_LABELS } from "@/components/layout/staff-nav";
import type { PendingInvitationView } from "@/features/invitations/schemas";
import {
  MEMBERSHIP_ROLES,
  passwordSchema,
  type StaffMemberView,
} from "@/features/staff/schemas";
import type { MembershipRole } from "@/generated/prisma/enums";
import { adminRequest, errorMessage } from "./admin-api";
import { AdminSection, initials, NativeSelect, Pill } from "./admin-ui";

type Confirm =
  | { kind: "deactivate"; member: StaffMemberView }
  | { kind: "revoke"; invitation: PendingInvitationView };

function formatExpiry(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

function PasswordDialog({
  clinicId,
  member,
  onClose,
}: {
  clinicId: string;
  member: StaffMemberView | null;
  onClose: () => void;
}) {
  const id = useId();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!member) return;
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the password.");
      return;
    }
    setPending(true);
    try {
      await adminRequest(
        `/api/clinics/${clinicId}/members/${member.membershipId}/password`,
        { method: "POST", body: { password } },
      );
      toast.success(
        `New password set for ${member.name}. They've been signed out everywhere.`,
      );
      setPassword("");
      setError(null);
      onClose();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={member !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password for {member?.name}</DialogTitle>
          <DialogDescription>
            Tell them the new password in person. They&apos;ll be signed out of
            every device.
          </DialogDescription>
        </DialogHeader>
        <form
          method="post"
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-4"
        >
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor={`${id}-password`}>New password</FieldLabel>
            <Input
              id={`${id}-password`}
              type="password"
              autoComplete="new-password"
              value={password}
              aria-invalid={error ? true : undefined}
              onChange={(event) => setPassword(event.target.value)}
              className="h-10"
            />
            {error && <FieldError>{error}</FieldError>}
          </Field>
          <Button
            type="submit"
            disabled={pending}
            className="h-10 rounded-btn font-semibold"
          >
            {pending ? "Saving…" : "Set new password"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function StaffManager({
  clinicId,
  members,
  invitations,
}: {
  clinicId: string;
  members: StaffMemberView[];
  invitations: PendingInvitationView[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [resetFor, setResetFor] = useState<StaffMemberView | null>(null);

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    try {
      await action();
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  }

  const updateMember = (
    member: StaffMemberView,
    body: { role?: MembershipRole; status?: "ACTIVE" | "INACTIVE" },
    message: string,
  ) =>
    run(member.membershipId, async () => {
      await adminRequest(
        `/api/clinics/${clinicId}/members/${member.membershipId}`,
        { method: "PATCH", body },
      );
      toast.success(message);
    });

  const revoke = (invitation: PendingInvitationView) =>
    run(invitation.id, async () => {
      await adminRequest(
        `/api/clinics/${clinicId}/invitations/${invitation.id}`,
        { method: "DELETE" },
      );
      toast.success(`Invitation for ${invitation.name} cancelled.`);
    });

  return (
    <div className="flex flex-col gap-3.5">
      {invitations.length > 0 && (
        <AdminSection
          title="Waiting to accept"
          description="Links can't be shown again. To send a fresh link, invite the person again."
        >
          <ul className="flex flex-col divide-y divide-divider">
            {invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{invitation.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {invitation.email} · {ROLE_LABELS[invitation.role]}
                  </p>
                </div>
                {invitation.expired ? (
                  <Pill tone="miss">Expired</Pill>
                ) : (
                  <Pill tone="wait">
                    Expires {formatExpiry(invitation.expiresAt)}
                  </Pill>
                )}
                <Button
                  variant="outline"
                  className="h-10 rounded-btn"
                  disabled={busy === invitation.id}
                  onClick={() => setConfirm({ kind: "revoke", invitation })}
                >
                  Cancel invitation
                </Button>
              </li>
            ))}
          </ul>
        </AdminSection>
      )}

      <AdminSection
        title="Team"
        description="Change a role, reset a password, or remove someone's access. Removing access keeps their history."
      >
        <ul className="flex flex-col divide-y divide-divider">
          {members.map((member) => {
            const inactive = member.status !== "ACTIVE";
            const selectId = `role-${member.membershipId}`;
            return (
              <li
                key={member.membershipId}
                className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-tint font-display text-sm font-bold text-slate"
                  >
                    {initials(member.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {member.name}
                      {member.isYou && <Pill tone="info">You</Pill>}
                      {inactive && <Pill tone="off">No access</Pill>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.email}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor={selectId} className="sr-only">
                    Role for {member.name}
                  </label>
                  <NativeSelect
                    id={selectId}
                    value={member.role}
                    disabled={
                      member.isYou || inactive || busy === member.membershipId
                    }
                    className="w-auto min-w-40"
                    onChange={(event) => {
                      const role = event.target.value as MembershipRole;
                      void updateMember(
                        member,
                        { role },
                        `${member.name} is now ${ROLE_LABELS[role].toLowerCase()}.`,
                      );
                    }}
                  >
                    {MEMBERSHIP_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </NativeSelect>
                  <Button
                    variant="outline"
                    className="h-10 rounded-btn"
                    disabled={member.isYou || inactive}
                    onClick={() => setResetFor(member)}
                  >
                    Reset password
                  </Button>
                  {inactive ? (
                    <Button
                      variant="outline"
                      className="h-10 rounded-btn"
                      disabled={busy === member.membershipId}
                      onClick={() =>
                        updateMember(
                          member,
                          { status: "ACTIVE" },
                          `${member.name} has access again.`,
                        )
                      }
                    >
                      Restore access
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="h-10 rounded-btn"
                      disabled={member.isYou || busy === member.membershipId}
                      onClick={() => setConfirm({ kind: "deactivate", member })}
                    >
                      Remove access
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </AdminSection>

      <PasswordDialog
        clinicId={clinicId}
        member={resetFor}
        onClose={() => setResetFor(null)}
      />

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "deactivate"
                ? `Remove ${confirm.member.name}'s access?`
                : `Cancel the invitation for ${confirm?.kind === "revoke" ? confirm.invitation.name : ""}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "deactivate"
                ? "They're signed out and can't open this clinic's screens. Their past actions stay in the audit log. You can restore access later."
                : "The link stops working straight away."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <Button
              disabled={busy !== null}
              onClick={() => {
                if (confirm?.kind === "deactivate") {
                  void updateMember(
                    confirm.member,
                    { status: "INACTIVE" },
                    `${confirm.member.name} no longer has access.`,
                  );
                } else if (confirm?.kind === "revoke") {
                  void revoke(confirm.invitation);
                }
              }}
            >
              {confirm?.kind === "deactivate"
                ? "Remove access"
                : "Cancel invitation"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
