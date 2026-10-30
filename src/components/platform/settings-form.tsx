"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
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
  const [pending, setPending] = useState(false);
  const hydrated = useHydrated();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const update = platformSettingsUpdateSchema.parse({ signupsEnabled });
    setPending(true);
    try {
      await requestJson("/api/platform/settings", {
        method: "PATCH",
        body: update,
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
      className="flex max-w-xl flex-col gap-5 rounded-card border border-border bg-card p-5 shadow-card"
    >
      <Field orientation="horizontal">
        <input
          id="signupsEnabled"
          type="checkbox"
          checked={signupsEnabled}
          onChange={(event) => setSignupsEnabled(event.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-brand"
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
