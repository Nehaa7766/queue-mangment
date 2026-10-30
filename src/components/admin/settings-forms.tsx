"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  clinicProfileSchema,
  queueSettingsSchema,
  type SettingsUpdate,
} from "@/features/clinics/schemas";
import { adminRequest, errorMessage } from "./admin-api";
import { CheckboxField, NativeSelect } from "./admin-ui";

type Errors = Record<string, string | undefined>;

function issuesToErrors(
  issues: readonly { path: PropertyKey[]; message: string }[],
): Errors {
  const errors: Errors = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}

export function useSettingsSave(clinicId: string) {
  const router = useRouter();
  return async (update: SettingsUpdate, message: string) => {
    await adminRequest(`/api/clinics/${clinicId}/settings`, {
      method: "PATCH",
      body: update,
    });
    toast.success(message);
    router.refresh();
  };
}

function SaveRow({
  pending,
  error,
  label = "Save",
}: {
  pending: boolean;
  error?: string;
  label?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {error && <FieldError>{error}</FieldError>}
      <div>
        <Button
          type="submit"
          disabled={pending}
          className="h-10 rounded-btn px-5 font-semibold"
        >
          {pending ? "Saving…" : label}
        </Button>
      </div>
    </div>
  );
}

function TextField({
  id,
  label,
  error,
  help,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  help?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
      {help && <FieldDescription id={`${id}-help`}>{help}</FieldDescription>}
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}

// Time zones clinics are likely to use; the current one is always listed.
const TIME_ZONES = [
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Asia/Dhaka",
  "Asia/Colombo",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "UTC",
];

export function ClinicProfileForm({
  clinicId,
  initial,
  slug,
}: {
  clinicId: string;
  initial: {
    name: string;
    address: string | null;
    phone: string | null;
    timezone: string;
  };
  slug: string;
}) {
  const id = useId();
  const save = useSettingsSave(clinicId);
  const [values, setValues] = useState({
    name: initial.name,
    address: initial.address ?? "",
    phone: initial.phone ?? "",
    timezone: initial.timezone,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const zones = TIME_ZONES.includes(initial.timezone)
    ? TIME_ZONES
    : [initial.timezone, ...TIME_ZONES];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = clinicProfileSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    setPending(true);
    try {
      await save(
        { section: "profile", ...parsed.data },
        "Clinic profile saved.",
      );
    } catch (error) {
      setErrors({ form: errorMessage(error) });
    } finally {
      setPending(false);
    }
  }

  const set = (key: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  return (
    <form
      method="post"
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-4"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <TextField id={`${id}-name`} label="Clinic name" error={errors.name}>
          <Input
            id={`${id}-name`}
            value={values.name}
            maxLength={120}
            aria-invalid={errors.name ? true : undefined}
            onChange={(event) => set("name")(event.target.value)}
            className="h-10"
          />
        </TextField>
        <TextField
          id={`${id}-phone`}
          label="Phone (optional)"
          error={errors.phone}
        >
          <Input
            id={`${id}-phone`}
            type="tel"
            value={values.phone}
            maxLength={30}
            aria-invalid={errors.phone ? true : undefined}
            onChange={(event) => set("phone")(event.target.value)}
            className="h-10"
          />
        </TextField>
        <TextField
          id={`${id}-address`}
          label="Address (optional)"
          error={errors.address}
        >
          <Input
            id={`${id}-address`}
            value={values.address}
            maxLength={200}
            onChange={(event) => set("address")(event.target.value)}
            className="h-10"
          />
        </TextField>
        <TextField
          id={`${id}-timezone`}
          label="Time zone"
          error={errors.timezone}
          help="Queue days and opening hours use this clock."
        >
          <NativeSelect
            id={`${id}-timezone`}
            value={values.timezone}
            aria-describedby={`${id}-timezone-help`}
            onChange={(event) => set("timezone")(event.target.value)}
          >
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replaceAll("_", " ")}
              </option>
            ))}
          </NativeSelect>
        </TextField>
      </div>
      <p className="text-sm text-muted-foreground">
        Public address:{" "}
        <span className="font-mono text-foreground">/q/{slug}</span>. It stays
        the same so printed QR codes keep working.
      </p>
      <SaveRow pending={pending} error={errors.form} label="Save profile" />
    </form>
  );
}

type QueueValues = {
  waitTargetMinutes: number;
  gracePeriodSeconds: number;
  maxQueueSize: number | null;
  noShowAction: "SKIP" | "REQUEUE";
  allowRequeue: boolean;
  patientDataRetentionDays: number;
};

export function QueueSettingsForm({
  clinicId,
  initial,
}: {
  clinicId: string;
  initial: QueueValues;
}) {
  const id = useId();
  const save = useSettingsSave(clinicId);
  const [values, setValues] = useState({
    waitTargetMinutes: String(initial.waitTargetMinutes),
    graceMinutes: String(initial.gracePeriodSeconds / 60),
    maxQueueSize:
      initial.maxQueueSize === null ? "" : String(initial.maxQueueSize),
    noShowAction: initial.noShowAction,
    allowRequeue: initial.allowRequeue,
    patientDataRetentionDays: String(initial.patientDataRetentionDays),
  });
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = queueSettingsSchema.safeParse({
      waitTargetMinutes: Number(values.waitTargetMinutes),
      gracePeriodSeconds: Math.round(Number(values.graceMinutes) * 60),
      maxQueueSize:
        values.maxQueueSize.trim() === "" ? null : Number(values.maxQueueSize),
      noShowAction: values.noShowAction,
      allowRequeue: values.allowRequeue,
      patientDataRetentionDays: Number(values.patientDataRetentionDays),
    });
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    setPending(true);
    try {
      await save({ section: "queue", ...parsed.data }, "Queue settings saved.");
    } catch (error) {
      setErrors({ form: errorMessage(error) });
    } finally {
      setPending(false);
    }
  }

  const number = (
    key:
      | "waitTargetMinutes"
      | "graceMinutes"
      | "maxQueueSize"
      | "patientDataRetentionDays",
    errorKey: string,
    label: string,
    help: string,
    range: { min: number; max: number },
  ) => (
    <TextField
      id={`${id}-${key}`}
      label={label}
      error={
        errors[errorKey] && `Enter a number from ${range.min} to ${range.max}.`
      }
      help={help}
    >
      <Input
        id={`${id}-${key}`}
        type="number"
        inputMode="numeric"
        min={range.min}
        max={range.max}
        value={values[key]}
        aria-invalid={errors[errorKey] ? true : undefined}
        aria-describedby={`${id}-${key}-help`}
        onChange={(event) =>
          setValues((current) => ({ ...current, [key]: event.target.value }))
        }
        className="h-10 tabular-nums"
      />
    </TextField>
  );

  return (
    <form
      method="post"
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-5"
    >
      <div className="grid gap-4 md:grid-cols-2">
        {number(
          "waitTargetMinutes",
          "waitTargetMinutes",
          "Wait-time target (minutes)",
          "Waits longer than this turn orange for reception.",
          { min: 5, max: 240 },
        )}
        {number(
          "graceMinutes",
          "gracePeriodSeconds",
          "Grace period (minutes)",
          "How long a called patient has to arrive.",
          { min: 1, max: 30 },
        )}
        {number(
          "maxQueueSize",
          "maxQueueSize",
          "Maximum waiting (optional)",
          "Leave empty for no limit. When full, patients see the queue as closed.",
          { min: 1, max: 1000 },
        )}
        {number(
          "patientDataRetentionDays",
          "patientDataRetentionDays",
          "Keep patient names for (days)",
          "Names are cleared after this; token numbers and times stay for reports.",
          { min: 1, max: 365 },
        )}
      </div>

      <FieldSet>
        <FieldLegend variant="label">
          When a called patient doesn&apos;t come
        </FieldLegend>
        <div className="flex flex-col gap-1">
          {(
            [
              [
                "SKIP",
                "Mark as no-show",
                "They can be put back in the queue by hand.",
              ],
              [
                "REQUEUE",
                "Send to the back of the queue",
                "Needs requeue turned on.",
              ],
            ] as const
          ).map(([value, label, description]) => (
            <label
              key={value}
              className="flex min-h-11 cursor-pointer items-start gap-3 py-1.5"
            >
              <input
                type="radio"
                name={`${id}-no-show`}
                value={value}
                checked={values.noShowAction === value}
                onChange={() =>
                  setValues((current) => ({ ...current, noShowAction: value }))
                }
                className="mt-0.5 size-5 accent-brand"
              />
              <span className="flex flex-col">
                <span className="text-sm font-medium">{label}</span>
                <span className="text-xs text-muted-foreground">
                  {description}
                </span>
              </span>
            </label>
          ))}
        </div>
        {errors.noShowAction && <FieldError>{errors.noShowAction}</FieldError>}
      </FieldSet>

      <CheckboxField
        label="Allow requeue"
        description="Reception can put a skipped patient back at the end of the queue."
        checked={values.allowRequeue}
        onChange={(event) =>
          setValues((current) => ({
            ...current,
            allowRequeue: event.target.checked,
          }))
        }
      />

      <SaveRow
        pending={pending}
        error={errors.form}
        label="Save queue settings"
      />
    </form>
  );
}
