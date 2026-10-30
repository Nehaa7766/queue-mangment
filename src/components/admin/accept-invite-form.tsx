"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { passwordSchema } from "@/features/staff/schemas";
import { cn } from "@/lib/utils";
import { adminRequest, errorMessage } from "./admin-api";

type Errors = { name?: string; password?: string; confirm?: string };

export function validateAcceptForm(
  values: { name: string; password: string; confirm: string },
  needsPassword: boolean,
): Errors {
  const errors: Errors = {};
  if (values.name.trim().length < 2) errors.name = "Enter your name.";
  if (needsPassword) {
    const password = passwordSchema.safeParse(values.password);
    if (!password.success) {
      errors.password = password.error.issues[0]?.message;
    } else if (values.password !== values.confirm) {
      errors.confirm = "The passwords don't match.";
    }
  }
  return errors;
}

// Sets up a staff account from an invitation link. Someone who already has
// an account just joins the clinic and keeps their password.
export function AcceptInviteForm({
  token,
  initialName,
  email,
  hasAccount,
}: {
  token: string;
  initialName: string;
  email: string;
  hasAccount: boolean;
}) {
  const id = useId();
  const [values, setValues] = useState({
    name: initialName,
    password: "",
    confirm: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validateAcceptForm(values, !hasAccount);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setFormError(null);
    setPending(true);
    try {
      await adminRequest(`/api/invitations/${token}/accept`, {
        method: "POST",
        body: hasAccount
          ? { name: values.name }
          : { name: values.name, password: values.password },
      });
      setDone(true);
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div role="status" className="flex flex-col gap-4">
        <p className="text-sm">
          You&apos;re in. Sign in with <strong>{email}</strong>
          {hasAccount
            ? " and your existing password."
            : " and your new password."}
        </p>
        <Link
          href="/login"
          className={cn(buttonVariants(), "h-11 rounded-btn font-semibold")}
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form
      method="post"
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-4"
    >
      <Field>
        <FieldLabel htmlFor={`${id}-email`}>Email</FieldLabel>
        <Input
          id={`${id}-email`}
          value={email}
          readOnly
          className="h-11 bg-muted"
        />
      </Field>
      <Field data-invalid={errors.name ? true : undefined}>
        <FieldLabel htmlFor={`${id}-name`}>Your name</FieldLabel>
        <Input
          id={`${id}-name`}
          value={values.name}
          maxLength={80}
          autoComplete="name"
          aria-invalid={errors.name ? true : undefined}
          onChange={(event) =>
            setValues((v) => ({ ...v, name: event.target.value }))
          }
          className="h-11"
        />
        {errors.name && <FieldError>{errors.name}</FieldError>}
      </Field>
      {hasAccount ? (
        <FieldDescription>
          You already have a QueueCare account, so you&apos;ll keep your current
          password.
        </FieldDescription>
      ) : (
        <>
          <Field data-invalid={errors.password ? true : undefined}>
            <FieldLabel htmlFor={`${id}-password`}>
              Choose a password
            </FieldLabel>
            <Input
              id={`${id}-password`}
              type="password"
              autoComplete="new-password"
              value={values.password}
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={`${id}-password-help`}
              onChange={(event) =>
                setValues((v) => ({ ...v, password: event.target.value }))
              }
              className="h-11"
            />
            <FieldDescription id={`${id}-password-help`}>
              At least 8 characters.
            </FieldDescription>
            {errors.password && <FieldError>{errors.password}</FieldError>}
          </Field>
          <Field data-invalid={errors.confirm ? true : undefined}>
            <FieldLabel htmlFor={`${id}-confirm`}>Type it again</FieldLabel>
            <Input
              id={`${id}-confirm`}
              type="password"
              autoComplete="new-password"
              value={values.confirm}
              aria-invalid={errors.confirm ? true : undefined}
              onChange={(event) =>
                setValues((v) => ({ ...v, confirm: event.target.value }))
              }
              className="h-11"
            />
            {errors.confirm && <FieldError>{errors.confirm}</FieldError>}
          </Field>
        </>
      )}
      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      <Button
        type="submit"
        disabled={pending}
        className="h-11 rounded-btn text-[15px] font-semibold"
      >
        {pending ? "Setting up…" : "Accept invitation"}
      </Button>
    </form>
  );
}
