"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getHomePath } from "@/lib/auth/actions";
import { authClient } from "@/lib/auth/client";

const signInSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

type FieldErrors = { email?: string; password?: string };

function messageForStatus(status: number | undefined): string {
  if (status === 401 || status === 403) {
    return "Email or password is incorrect.";
  }
  if (status === 429) {
    return "Too many attempts. Wait a minute and try again.";
  }
  return "We couldn't sign you in. Please try again.";
}

export function LoginForm() {
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = signInSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      const errors = z.flattenError(parsed.error).fieldErrors;
      setFieldErrors({
        email: errors.email?.[0],
        password: errors.password?.[0],
      });
      setFormError(null);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setPending(true);
    try {
      const { error } = await authClient.signIn.email(parsed.data);
      if (error) {
        setFormError(messageForStatus(error.status));
        return;
      }
      router.replace(await getHomePath());
      router.refresh();
    } catch {
      setFormError(messageForStatus(undefined));
    } finally {
      setPending(false);
    }
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

      <Field data-invalid={fieldErrors.email ? true : undefined}>
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="h-11"
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
        />
        <FieldError id="email-error">{fieldErrors.email}</FieldError>
      </Field>

      <Field data-invalid={fieldErrors.password ? true : undefined}>
        <FieldLabel htmlFor="password">Password</FieldLabel>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-11"
          aria-invalid={fieldErrors.password ? true : undefined}
          aria-describedby={fieldErrors.password ? "password-error" : undefined}
        />
        <FieldError id="password-error">{fieldErrors.password}</FieldError>
      </Field>

      <Button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-btn font-semibold"
      >
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      <Link
        href="/forgot-password"
        className="self-center rounded-sm text-sm font-medium text-slate underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        Forgot password?
      </Link>
    </form>
  );
}
