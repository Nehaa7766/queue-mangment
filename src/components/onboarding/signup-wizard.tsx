"use client";

import { CheckIcon, CircleCheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { errorMessage, requestJson } from "@/components/platform/request";
import { NativeSelect } from "@/components/platform/native-select";
import { useHydrated } from "@/components/platform/use-hydrated";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_TIMEZONE,
  PASSWORD_MIN,
  SIGNUP_STEPS,
  TIMEZONE_OPTIONS,
  signupSchema,
  type SignupInput,
  type SignupResponse,
  type SlugAvailabilityResponse,
} from "@/features/onboarding/signup-schema";
import { suggestSlug } from "@/features/onboarding/slug";
import { cn } from "@/lib/utils";

type Values = Record<keyof SignupInput, string>;
type Errors = Partial<Record<keyof SignupInput, string>>;
type SlugCheck =
  | { state: "idle" | "checking" }
  | { state: "available" }
  | { state: "taken"; reason: string };

const INITIAL: Values = {
  clinicName: "",
  clinicSlug: "",
  timezone: DEFAULT_TIMEZONE,
  serviceName: "General",
  tokenPrefix: "A",
  serviceMinutes: "10",
  adminName: "",
  adminEmail: "",
  password: "",
};

function toInput(values: Values) {
  return {
    ...values,
    serviceMinutes:
      values.serviceMinutes.trim() === ""
        ? Number.NaN
        : Number(values.serviceMinutes),
  };
}

// Three short steps; each is checked before moving on, and the server checks
// everything again on submit.
export function SignupWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>(INITIAL);
  const [errors, setErrors] = useState<Errors>({});
  const [slugEdited, setSlugEdited] = useState(false);
  // Availability answers keyed by slug, so a late answer for an old value
  // never shows against the current one.
  const [slugAnswers, setSlugAnswers] = useState<Record<string, SlugCheck>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const hydrated = useHydrated();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const stepChanged = useRef(false);

  const parsedSlug = signupSchema.shape.clinicSlug.safeParse(values.clinicSlug);
  const slugToCheck = parsedSlug.success ? parsedSlug.data : null;
  const slugCheck: SlugCheck = slugToCheck
    ? (slugAnswers[slugToCheck] ?? { state: "checking" })
    : { state: "idle" };

  const set = (key: keyof Values, value: string) => {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (key === "clinicName" && !slugEdited) {
        next.clinicSlug = suggestSlug(value);
      }
      return next;
    });
    setErrors((current) => ({
      ...current,
      [key]: undefined,
      // The suggested address replaces whatever was wrong with the old one.
      ...(key === "clinicName" && !slugEdited && { clinicSlug: undefined }),
    }));
  };

  // Check the address while people type, after a short pause.
  useEffect(() => {
    if (!slugToCheck) return;
    const timer = setTimeout(async () => {
      let answer: SlugCheck;
      try {
        const result = await requestJson<SlugAvailabilityResponse>(
          `/api/onboarding/slug-availability?slug=${encodeURIComponent(slugToCheck)}`,
        );
        answer = result.available
          ? { state: "available" }
          : {
              state: "taken",
              reason: result.reason ?? "That address is taken.",
            };
      } catch {
        // The server checks again on submit.
        answer = { state: "idle" };
      }
      setSlugAnswers((current) => ({ ...current, [slugToCheck]: answer }));
    }, 400);
    return () => clearTimeout(timer);
  }, [slugToCheck]);

  // Move focus to the new step's heading, but not on the first render.
  useEffect(() => {
    if (stepChanged.current) headingRef.current?.focus();
    stepChanged.current = true;
  }, [step]);

  function validate(fields: readonly (keyof SignupInput)[]): boolean {
    const parsed = signupSchema.safeParse(toInput(values));
    const stepErrors: Errors = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof SignupInput;
        if (fields.includes(key)) stepErrors[key] ??= issue.message;
      }
    }
    if (
      fields.includes("clinicSlug") &&
      !stepErrors.clinicSlug &&
      slugCheck.state === "taken"
    ) {
      stepErrors.clinicSlug = slugCheck.reason;
    }
    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!validate(SIGNUP_STEPS[step].fields)) return;
    if (step < SIGNUP_STEPS.length - 1) {
      setStep(step + 1);
      return;
    }
    const parsed = signupSchema.safeParse(toInput(values));
    if (!parsed.success) {
      // A field on an earlier step changed; go back to the first problem.
      const first = parsed.error.issues[0].path[0] as keyof SignupInput;
      const index = SIGNUP_STEPS.findIndex((s) =>
        (s.fields as readonly string[]).includes(first),
      );
      setStep(Math.max(0, index));
      validate(SIGNUP_STEPS[Math.max(0, index)].fields);
      return;
    }
    setPending(true);
    try {
      const result = await requestJson<SignupResponse>(
        "/api/onboarding/signup",
        {
          method: "POST",
          body: parsed.data,
        },
      );
      router.push(
        `/signup/pending?clinic=${encodeURIComponent(result.clinicSlug)}`,
      );
    } catch (error) {
      setFormError(errorMessage(error));
      setPending(false);
    }
  }

  const current = SIGNUP_STEPS[step];
  const field = (
    key: keyof SignupInput,
    label: string,
    input: React.ReactNode,
    description?: React.ReactNode,
  ) => (
    <Field data-invalid={errors[key] ? true : undefined}>
      <FieldLabel htmlFor={key}>{label}</FieldLabel>
      {input}
      {description && <FieldDescription>{description}</FieldDescription>}
      <FieldError>{errors[key]}</FieldError>
    </Field>
  );
  const text = (
    key: keyof SignupInput,
    props: React.ComponentProps<typeof Input> = {},
  ) => (
    <Input
      id={key}
      name={key}
      value={values[key]}
      aria-invalid={errors[key] ? true : undefined}
      onChange={(event) => set(key, event.target.value)}
      className="h-11 text-base md:text-sm"
      {...props}
    />
  );

  return (
    <div className="flex flex-col gap-5">
      <ol
        className="flex items-center gap-2 rounded-card border border-border bg-card p-4 shadow-card sm:gap-3 sm:p-5"
        aria-label="Sign-up steps"
      >
        {SIGNUP_STEPS.map((s, index) => {
          const done = index < step;
          const current = index === step;
          return (
            <li
              key={s.title}
              aria-current={current ? "step" : undefined}
              className="flex flex-1 items-center gap-2"
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                  done && "bg-brand text-white",
                  current && "border-2 border-brand text-brand",
                  !done &&
                    !current &&
                    "border border-border text-muted-foreground",
                )}
              >
                {done ? <CheckIcon className="size-4" /> : index + 1}
              </span>
              <span
                className={cn(
                  "min-w-0 text-xs font-medium sm:text-sm",
                  index <= step ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <span className="sr-only">Step {index + 1}: </span>
                {s.title}
              </span>
              {index < SIGNUP_STEPS.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    "hidden h-0.5 min-w-4 flex-1 rounded-full sm:block",
                    done ? "bg-brand" : "bg-divider",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>

      <form
        method="post"
        noValidate
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-card border border-border bg-card p-5 shadow-card md:p-6"
      >
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-lg font-bold outline-none"
        >
          Step {step + 1} of {SIGNUP_STEPS.length}: {current.title}
        </h2>

        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        {step === 0 && (
          <>
            {field(
              "clinicName",
              "Clinic name",
              text("clinicName", { autoComplete: "organization" }),
            )}
            {field(
              "clinicSlug",
              "Public address",
              text("clinicSlug", {
                autoCapitalize: "none",
                spellCheck: false,
                onChange: (event) => {
                  setSlugEdited(true);
                  set("clinicSlug", event.target.value.toLowerCase());
                },
              }),
              <span aria-live="polite">
                Patients open /q/{values.clinicSlug || "your-clinic"}.{" "}
                {slugCheck.state === "checking" && "Checking…"}
                {slugCheck.state === "available" && (
                  <span className="inline-flex items-center gap-1 font-medium text-status-done-foreground">
                    <CircleCheckIcon className="size-3.5" aria-hidden />
                    Available
                  </span>
                )}
                {slugCheck.state === "taken" && !errors.clinicSlug && (
                  <span className="font-medium text-danger-text">
                    {slugCheck.reason}
                  </span>
                )}
              </span>,
            )}
            {field(
              "timezone",
              "Time zone",
              <NativeSelect
                id="timezone"
                name="timezone"
                value={values.timezone}
                onChange={(event) => set("timezone", event.target.value)}
                className="h-11"
              >
                {TIMEZONE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>,
              "Queues reset each day in this time zone.",
            )}
          </>
        )}

        {step === 1 && (
          <>
            {field(
              "serviceName",
              "First service",
              text("serviceName"),
              "You can add more services after sign-up.",
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {field(
                "tokenPrefix",
                "Token letter",
                text("tokenPrefix", {
                  autoCapitalize: "characters",
                  maxLength: 3,
                  onChange: (event) =>
                    set("tokenPrefix", event.target.value.toUpperCase()),
                }),
                `Tokens look like ${values.tokenPrefix || "A"}-17.`,
              )}
              {field(
                "serviceMinutes",
                "Minutes per patient",
                text("serviceMinutes", {
                  type: "number",
                  inputMode: "numeric",
                  min: 1,
                  max: 240,
                }),
                "Used for the first wait estimates.",
              )}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            {field(
              "adminName",
              "Your name",
              text("adminName", { autoComplete: "name" }),
            )}
            {field(
              "adminEmail",
              "Email",
              text("adminEmail", { type: "email", autoComplete: "email" }),
              "You'll sign in with this as the clinic admin.",
            )}
            {field(
              "password",
              "Password",
              text("password", {
                type: "password",
                autoComplete: "new-password",
              }),
              `At least ${PASSWORD_MIN} characters.`,
            )}
            <p className="rounded-btn bg-muted px-3 py-2 text-sm text-muted-foreground">
              {values.clinicName || "Your clinic"} at /q/
              {values.clinicSlug || "your-clinic"} · first service{" "}
              {values.serviceName || "General"} ({values.tokenPrefix || "A"})
            </p>
          </>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {step > 0 && (
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-btn px-5 md:h-11"
              onClick={() => {
                setErrors({});
                setStep(step - 1);
              }}
            >
              Back
            </Button>
          )}
          <Button
            type="submit"
            disabled={pending || !hydrated}
            className="h-12 flex-1 rounded-btn px-5 font-semibold sm:flex-none md:h-11"
          >
            {step < SIGNUP_STEPS.length - 1
              ? "Next"
              : pending
                ? "Creating your clinic…"
                : "Create clinic"}
          </Button>
        </div>
      </form>
    </div>
  );
}
