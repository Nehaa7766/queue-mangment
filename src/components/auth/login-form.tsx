"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getHomePath } from "@/lib/auth/actions";
import { authClient } from "@/lib/auth/client";
import type { DemoAccount } from "@/lib/auth/demo-accounts";

const signInSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

type FieldErrors = { email?: string; password?: string };

const LABEL = "text-xs font-semibold text-foreground";
const INPUT = "h-12 rounded-btn bg-card px-4";

function messageForStatus(status: number | undefined): string {
  if (status === 401 || status === 403) {
    return "Email or password is incorrect.";
  }
  if (status === 429) {
    return "Too many attempts. Wait a minute and try again.";
  }
  return "We couldn't sign you in. Please try again.";
}

export function LoginForm({
  demo,
}: {
  // Demo accounts to offer under the form (development and demo servers).
  demo?: { accounts: DemoAccount[]; password: string };
}) {
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);

  // Fills both fields and moves focus to the button, so Enter signs in.
  function fillDemoAccount(email: string, password: string) {
    if (emailRef.current) emailRef.current.value = email;
    if (passwordRef.current) passwordRef.current.value = password;
    setFieldErrors({});
    setFormError(null);
    submitRef.current?.focus();
  }

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
      className="flex flex-col gap-5"
    >
      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <Field data-invalid={fieldErrors.email ? true : undefined}>
        <FieldLabel htmlFor="email" className={LABEL}>
          Email
        </FieldLabel>
        <Input
          ref={emailRef}
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="you@clinic.com"
          required
          className={INPUT}
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
        />
        <FieldError id="email-error">{fieldErrors.email}</FieldError>
      </Field>

      <Field data-invalid={fieldErrors.password ? true : undefined}>
        <div className="flex items-baseline justify-between gap-3">
          <FieldLabel htmlFor="password" className={LABEL}>
            Password
          </FieldLabel>
          {/* Short on screen; the full "Forgot password?" for screen readers. */}
          <Link
            href="/forgot-password"
            className="rounded-sm text-xs font-medium text-brand underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Forgot<span className="sr-only"> password</span>?
          </Link>
        </div>
        <Input
          ref={passwordRef}
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          required
          className={INPUT}
          aria-invalid={fieldErrors.password ? true : undefined}
          aria-describedby={fieldErrors.password ? "password-error" : undefined}
        />
        <FieldError id="password-error">{fieldErrors.password}</FieldError>
      </Field>

      <Button
        ref={submitRef}
        type="submit"
        disabled={pending}
        className="mt-1 h-12 w-full rounded-btn text-sm font-semibold"
      >
        {pending ? "Opening…" : "Open my counter"}
      </Button>

      {demo && demo.accounts.length > 0 && (
        <section
          aria-labelledby="demo-accounts-title"
          className="rounded-btn border border-dashed border-border bg-background/60 p-3"
        >
          {/* Named "Demo accounts" only, so the region doesn't also match
              getByLabel("Password"). */}
          <p className="text-xs font-semibold">
            <span id="demo-accounts-title">Demo accounts</span>{" "}
            <span className="font-normal text-muted-foreground">
              · password <code className="font-mono">{demo.password}</code>
            </span>
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {demo.accounts.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => fillDemoAccount(account.email, demo.password)}
                className="min-w-0 rounded-btn border border-border bg-card px-3 py-2 text-left transition-colors outline-none hover:border-brand hover:bg-brand-tint focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="block text-xs font-semibold">
                  {account.role}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {account.email}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </form>
  );
}
