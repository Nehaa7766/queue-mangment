"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ROLE_LABELS } from "@/components/layout/staff-nav";
import {
  invitationInputSchema,
  type InvitationInput,
} from "@/features/invitations/schemas";
import { MEMBERSHIP_ROLES } from "@/features/staff/schemas";
import { adminRequest, errorMessage } from "./admin-api";
import { NativeSelect } from "./admin-ui";

type Errors = Partial<Record<keyof InvitationInput | "form", string>>;

export function validateInvitation(values: {
  name: string;
  email: string;
  role: string;
}): { data: InvitationInput | null; errors: Errors } {
  const result = invitationInputSchema.safeParse(values);
  if (result.success) return { data: result.data, errors: {} };
  const errors: Errors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof InvitationInput;
    errors[key] ??= issue.message;
  }
  return { data: null, errors };
}

// Invites a staff member. The email is sent by the outbox worker; the link
// is also shown here so it can be shared another way, e.g. before email is
// set up. It is shown once: only a hash is stored.
export function InviteForm({ clinicId }: { clinicId: string }) {
  const id = useId();
  const router = useRouter();
  const [values, setValues] = useState({
    name: "",
    email: "",
    role: "RECEPTIONIST",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<{ name: string; link: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { data, errors: found } = validateInvitation(values);
    setErrors(found);
    if (!data) return;
    setPending(true);
    try {
      const result = await adminRequest<{ acceptUrl: string }>(
        `/api/clinics/${clinicId}/invitations`,
        { method: "POST", body: data },
      );
      setSent({ name: data.name, link: result.acceptUrl });
      setValues({ name: "", email: "", role: data.role });
      toast.success(`Invitation created for ${data.name}.`);
      router.refresh();
    } catch (error) {
      setErrors({ form: errorMessage(error) });
    } finally {
      setPending(false);
    }
  }

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied.");
    } catch {
      toast.error("Couldn't copy. Select the link and copy it by hand.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        method="post"
        onSubmit={handleSubmit}
        noValidate
        className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_auto] md:items-start"
      >
        <Field data-invalid={errors.name ? true : undefined}>
          <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
          <Input
            id={`${id}-name`}
            value={values.name}
            maxLength={80}
            autoComplete="off"
            aria-invalid={errors.name ? true : undefined}
            onChange={(event) =>
              setValues((v) => ({ ...v, name: event.target.value }))
            }
            className="h-10"
          />
          {errors.name && <FieldError>{errors.name}</FieldError>}
        </Field>
        <Field data-invalid={errors.email ? true : undefined}>
          <FieldLabel htmlFor={`${id}-email`}>Email</FieldLabel>
          <Input
            id={`${id}-email`}
            type="email"
            value={values.email}
            autoComplete="off"
            aria-invalid={errors.email ? true : undefined}
            onChange={(event) =>
              setValues((v) => ({ ...v, email: event.target.value }))
            }
            className="h-10"
          />
          {errors.email && <FieldError>{errors.email}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-role`}>Role</FieldLabel>
          <NativeSelect
            id={`${id}-role`}
            value={values.role}
            onChange={(event) =>
              setValues((v) => ({ ...v, role: event.target.value }))
            }
          >
            {MEMBERSHIP_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Button
          type="submit"
          disabled={pending}
          className="h-10 rounded-btn px-5 font-semibold md:mt-[26px]"
        >
          {pending ? "Inviting…" : "Send invitation"}
        </Button>
        {errors.form && (
          <FieldError className="md:col-span-4">{errors.form}</FieldError>
        )}
      </form>

      {sent && (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-btn border border-border bg-slate-tint p-3"
        >
          <p className="text-sm font-semibold">
            Invitation ready for {sent.name}
          </p>
          <FieldDescription>
            We&apos;ll email it when email is set up. You can also send this
            link yourself. It works once and expires in 7 days.
          </FieldDescription>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              readOnly
              value={sent.link}
              aria-label="Invitation link"
              onFocus={(event) => event.target.select()}
              className="h-10 bg-card font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-btn"
              onClick={() => copy(sent.link)}
            >
              Copy link
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
