"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

// Better Auth's default limits.
const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

const resetSchema = z
  .object({
    password: z
      .string()
      .min(MIN_LENGTH, `Use at least ${MIN_LENGTH} characters.`)
      .max(MAX_LENGTH, `Use at most ${MAX_LENGTH} characters.`),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    path: ["confirm"],
    message: "The passwords don't match.",
  });

type FieldErrors = { password?: string; confirm?: string };

const LINK_INVALID =
  "This reset link is invalid or has expired. Ask for a new one.";

export function ResetPasswordForm() {
  const token = useSearchParams().get("token");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(
    token ? null : LINK_INVALID,
  );
  const [linkInvalid, setLinkInvalid] = useState(!token);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }
    const form = new FormData(event.currentTarget);
    const parsed = resetSchema.safeParse({
      password: form.get("password"),
      confirm: form.get("confirm"),
    });
    if (!parsed.success) {
      const errors = z.flattenError(parsed.error).fieldErrors;
      setFieldErrors({
        password: errors.password?.[0],
        confirm: errors.confirm?.[0],
      });
      setFormError(null);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setPending(true);
    try {
      const { error } = await authClient.resetPassword({
        newPassword: parsed.data.password,
        token,
      });
      if (error) {
        if (error.status === 429) {
          setFormError("Too many attempts. Wait a minute and try again.");
        } else if (error.code === "INVALID_TOKEN") {
          setLinkInvalid(true);
          setFormError(LINK_INVALID);
        } else {
          setFormError("We couldn't change the password. Please try again.");
        }
        return;
      }
      setDone(true);
    } catch {
      setFormError("We couldn't change the password. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <Alert role="status">
          <AlertDescription>
            Your password has been changed. You&apos;ve been signed out on other
            devices.
          </AlertDescription>
        </Alert>
        <Link
          href="/login"
          className={cn(
            buttonVariants(),
            "h-11 w-full rounded-btn font-semibold",
          )}
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (linkInvalid) {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="destructive">
          <AlertDescription>{formError ?? LINK_INVALID}</AlertDescription>
        </Alert>
        <Link
          href="/forgot-password"
          className={cn(
            buttonVariants(),
            "h-11 w-full rounded-btn font-semibold",
          )}
        >
          Get a new link
        </Link>
      </div>
    );
  }

  return (
    <form
      method="post"
      noValidate
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
    >
      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <Field data-invalid={fieldErrors.password ? true : undefined}>
        <FieldLabel htmlFor="password">New password</FieldLabel>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_LENGTH}
          maxLength={MAX_LENGTH}
          className="h-11"
          aria-invalid={fieldErrors.password ? true : undefined}
          aria-describedby="password-hint password-error"
        />
        <p id="password-hint" className="text-sm text-muted-foreground">
          At least {MIN_LENGTH} characters.
        </p>
        <FieldError id="password-error">{fieldErrors.password}</FieldError>
      </Field>

      <Field data-invalid={fieldErrors.confirm ? true : undefined}>
        <FieldLabel htmlFor="confirm">Confirm new password</FieldLabel>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          className="h-11"
          aria-invalid={fieldErrors.confirm ? true : undefined}
          aria-describedby={fieldErrors.confirm ? "confirm-error" : undefined}
        />
        <FieldError id="confirm-error">{fieldErrors.confirm}</FieldError>
      </Field>

      <Button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-btn font-semibold"
      >
        {pending ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
