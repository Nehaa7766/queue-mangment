"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getHomePath } from "@/lib/auth/actions";
import { authClient } from "@/lib/auth/client";

// Lets the demo accounts box (demo-accounts.tsx) fill in this form.
export const DemoFillContext = createContext<
  ((email: string, password: string) => void) | null
>(null);

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
  children,
}: {
  // Shown under the button: the demo accounts box, where enabled. It streams
  // in on its own, so the form itself is never replaced while someone types.
  children?: ReactNode;
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

      <DemoFillContext value={fillDemoAccount}>{children}</DemoFillContext>
    </form>
  );
}
