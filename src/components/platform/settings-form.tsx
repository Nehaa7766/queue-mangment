"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  platformSettingsUpdateSchema,
  type PlatformSettings,
} from "@/features/platform/settings";
import { errorMessage, requestJson } from "./request";
import { useHydrated } from "./use-hydrated";

export function PlatformSettingsForm({
  initial,
}: {
  initial: PlatformSettings;
}) {
  const router = useRouter();
  const [signupsEnabled, setSignupsEnabled] = useState(initial.signupsEnabled);
  const [trialDays, setTrialDays] = useState(String(initial.defaultTrialDays));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const hydrated = useHydrated();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = platformSettingsUpdateSchema.safeParse({
      signupsEnabled,
      defaultTrialDays: Number(trialDays),
    });
    if (!parsed.success || trialDays.trim() === "") {
      setError("Use a whole number of days from 0 to 365.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      await requestJson("/api/platform/settings", {
        method: "PATCH",
        body: parsed.data,
      });
      toast.success("Platform settings saved.");
      router.refresh();
    } catch (requestError) {
      toast.error(errorMessage(requestError));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      method="post"
      noValidate
      onSubmit={handleSubmit}
      className="flex max-w-xl flex-col gap-5 rounded-card border border-border bg-card p-5"
    >
      <Field orientation="horizontal">
        <input
          id="signupsEnabled"
          type="checkbox"
          checked={signupsEnabled}
          onChange={(event) => setSignupsEnabled(event.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-slate"
        />
        <FieldContent>
          <FieldLabel htmlFor="signupsEnabled">
            Allow new clinics to sign up
          </FieldLabel>
          <FieldDescription>
            When off, the public sign-up page tells visitors to contact support.
          </FieldDescription>
        </FieldContent>
      </Field>

      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor="defaultTrialDays">Trial length (days)</FieldLabel>
        <Input
          id="defaultTrialDays"
          type="number"
          inputMode="numeric"
          min={0}
          max={365}
          value={trialDays}
          aria-invalid={error ? true : undefined}
          onChange={(event) => setTrialDays(event.target.value)}
          className="h-10 w-32"
        />
        <FieldDescription>
          Applies to clinics that sign up from now on.
        </FieldDescription>
        <FieldError>{error}</FieldError>
      </Field>

      <div>
        <Button
          type="submit"
          disabled={pending || !hydrated}
          className="h-11 rounded-btn px-5 font-semibold"
        >
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
