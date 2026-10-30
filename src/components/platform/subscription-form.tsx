"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatMinor } from "@/features/platform/billing";
import {
  SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_STATUS_LABELS,
  subscriptionUpdateSchema,
} from "@/features/platform/schemas";
import type { SubscriptionStatus } from "@/generated/prisma/enums";
import { NativeSelect } from "./native-select";
import { errorMessage, requestJson } from "./request";
import { useHydrated } from "./use-hydrated";

export type SubscriptionFormPlan = {
  id: string;
  name: string;
  priceMonthlyMinor: number;
  currency: string;
  isActive: boolean;
};

type Values = {
  planId: string;
  status: SubscriptionStatus;
  trialEndsAt: string;
  currentPeriodEnd: string;
};

// Edit by hand: there is no payment provider yet (docs/COMMERCIAL.md).
export function SubscriptionForm({
  clinicId,
  plans,
  initial,
}: {
  clinicId: string;
  plans: SubscriptionFormPlan[];
  initial: Values;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>(
    {},
  );
  const [pending, setPending] = useState(false);
  const hydrated = useHydrated();

  const set = (key: keyof Values) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = subscriptionUpdateSchema.safeParse({
      ...values,
      trialEndsAt: values.trialEndsAt || null,
      currentPeriodEnd: values.currentPeriodEnd || null,
    });
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof Values, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof Values;
        fieldErrors[key] ??= issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setPending(true);
    try {
      await requestJson(`/api/platform/clinics/${clinicId}/subscription`, {
        method: "PUT",
        body: parsed.data,
      });
      toast.success("Subscription saved.");
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      method="post"
      noValidate
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-card border border-border bg-card p-5"
    >
      <Field data-invalid={errors.planId ? true : undefined}>
        <FieldLabel htmlFor="planId">Plan</FieldLabel>
        <NativeSelect
          id="planId"
          value={values.planId}
          aria-invalid={errors.planId ? true : undefined}
          onChange={(event) => set("planId")(event.target.value)}
        >
          <option value="">Choose a plan</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} · {formatMinor(plan.priceMonthlyMinor, plan.currency)}
              /month{plan.isActive ? "" : " (retired)"}
            </option>
          ))}
        </NativeSelect>
        <FieldError>{errors.planId}</FieldError>
      </Field>

      <Field>
        <FieldLabel htmlFor="status">Status</FieldLabel>
        <NativeSelect
          id="status"
          value={values.status}
          onChange={(event) => set("status")(event.target.value)}
        >
          {SUBSCRIPTION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {SUBSCRIPTION_STATUS_LABELS[status]}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={errors.trialEndsAt ? true : undefined}>
          <FieldLabel htmlFor="trialEndsAt">Trial ends</FieldLabel>
          <Input
            id="trialEndsAt"
            type="date"
            value={values.trialEndsAt}
            onChange={(event) => set("trialEndsAt")(event.target.value)}
            className="h-10"
          />
          <FieldError>{errors.trialEndsAt}</FieldError>
        </Field>
        <Field data-invalid={errors.currentPeriodEnd ? true : undefined}>
          <FieldLabel htmlFor="currentPeriodEnd">
            Current period ends
          </FieldLabel>
          <Input
            id="currentPeriodEnd"
            type="date"
            value={values.currentPeriodEnd}
            onChange={(event) => set("currentPeriodEnd")(event.target.value)}
            className="h-10"
          />
          <FieldError>{errors.currentPeriodEnd}</FieldError>
        </Field>
      </div>

      <div>
        <Button
          type="submit"
          disabled={pending || !hydrated}
          className="h-11 rounded-btn px-5 font-semibold"
        >
          {pending ? "Saving…" : "Save subscription"}
        </Button>
      </div>
    </form>
  );
}
