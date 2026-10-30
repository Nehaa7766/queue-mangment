"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";

const emailSchema = z.email("Enter a valid email address.");

// The same message whether or not the account exists, so the form can't be
// used to find out who works at a clinic.
export const RESET_REQUESTED_MESSAGE =
  "If an account uses that email, we've sent a link to reset the password. The link works for 1 hour.";

export function ForgotPasswordForm() {
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = emailSchema.safeParse(
      new FormData(event.currentTarget).get("email"),
    );
    if (!parsed.success) {
      setEmailError(parsed.error.issues[0]?.message ?? null);
      setFormError(null);
      return;
    }

    setEmailError(null);
    setFormError(null);
    setPending(true);
    try {
      const { error } = await authClient.requestPasswordReset({
        email: parsed.data,
      });
      if (error) {
        setFormError(
          error.status === 429
            ? "Too many requests. Wait a minute and try again."
            : "We couldn't send the link. Please try again.",
        );
        return;
      }
      setRequested(true);
    } catch {
      setFormError("We couldn't send the link. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (requested) {
    return (
      <div className="flex flex-col gap-4">
        <Alert role="status">
          <AlertDescription>{RESET_REQUESTED_MESSAGE}</AlertDescription>
        </Alert>
        <BackToSignIn />
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

      <Field data-invalid={emailError ? true : undefined}>
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="h-11"
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? "email-error" : undefined}
        />
        <FieldError id="email-error">{emailError}</FieldError>
      </Field>

      <Button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-btn font-semibold"
      >
        {pending ? "Sending link…" : "Send reset link"}
      </Button>

      <BackToSignIn />
    </form>
  );
}

function BackToSignIn() {
  return (
    <Link
      href="/login"
      className="self-center rounded-sm text-sm font-medium text-slate underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      Back to sign in
    </Link>
  );
}
