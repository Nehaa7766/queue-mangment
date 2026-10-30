"use client";

import { ImageUpIcon, Trash2Icon } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  WEEKDAYS,
  WEEKDAY_LABELS,
  type Weekday,
} from "@/features/clinics/opening-hours";
import {
  CLINIC_TYPES,
  CLINIC_TYPE_LABELS,
  INDIAN_STATES,
  LOGO_CONTENT_TYPES,
  LOGO_MAX_BYTES,
  type LogoUpload,
  type SimpleHours,
} from "@/features/clinics/profile-fields";
import { cn } from "@/lib/utils";
import { ClinicAvatar } from "./clinic-avatar";
import {
  CheckboxField,
  FormSection,
  SelectField,
  TextField,
  type FieldErrors,
} from "./form-kit";

// The clinic profile fields shared by the super admin's add and edit sheets:
// clinic, contact, location and hours. The slug field differs between the
// two (suggested from the name on add, locked by patient history on edit),
// so each form passes its own.

export type ProfileValues = {
  name: string;
  slug: string;
  timezone: string;
  status: "ACTIVE" | "INACTIVE";
  clinicType: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  openingTime: string;
  closingTime: string;
  workingDays: Weekday[];
};

export type ProfileErrors = FieldErrors<keyof ProfileValues | "logo">;

export const DEFAULT_HOURS: SimpleHours = {
  openingTime: "09:00",
  closingTime: "18:00",
  workingDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
};

// What to do with the logo on save.
export type LogoChoice =
  { kind: "keep" } | { kind: "remove" } | { kind: "new"; upload: LogoUpload };

// The request body for these fields. `sendHours` false keeps the stored
// hours (custom hours the simple fields can't show).
export function profileBody(
  values: ProfileValues,
  logo: LogoChoice,
  sendHours: boolean,
) {
  const { openingTime, closingTime, workingDays, ...fields } = values;
  return {
    ...fields,
    hours: sendHours ? { openingTime, closingTime, workingDays } : null,
    ...(logo.kind === "new" && { logo: logo.upload }),
    ...(logo.kind === "remove" && { logo: null }),
  };
}

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active: staff screens and patient page on" },
  { value: "INACTIVE", label: "Inactive: everything off until activated" },
];

const TYPE_OPTIONS = [
  { value: "", label: "Choose a type" },
  ...CLINIC_TYPES.map((type) => ({
    value: type,
    label: CLINIC_TYPE_LABELS[type],
  })),
];

const STATE_OPTIONS = [
  { value: "", label: "Choose a state" },
  ...INDIAN_STATES.map((state) => ({ value: state, label: state })),
];

export function ClinicProfileFields({
  idPrefix,
  values,
  set,
  errors,
  slugField,
  timezones,
  logo,
  hours,
}: {
  idPrefix: string;
  values: ProfileValues;
  set: <K extends keyof ProfileValues>(key: K, value: ProfileValues[K]) => void;
  errors: ProfileErrors;
  slugField: ReactNode;
  timezones: readonly { value: string; label: string }[];
  logo: {
    currentUrl: string | null;
    choice: LogoChoice;
    onChoice: (choice: LogoChoice) => void;
  };
  // On edit, clinics with custom hours keep them unless replaced.
  hours?: { note: string; replace: boolean; onReplace: (on: boolean) => void };
}) {
  const id = (field: string) => `${idPrefix}-${field}`;
  const hoursLocked = hours !== undefined && !hours.replace;
  return (
    <>
      <FormSection title="Clinic">
        <TextField
          id={id("name")}
          label="Clinic name"
          value={values.name}
          onChange={(value) => set("name", value)}
          error={errors.name}
          autoComplete="organization"
        />
        <LogoField
          id={id("logo")}
          name={values.name}
          currentUrl={logo.currentUrl}
          choice={logo.choice}
          onChoice={logo.onChoice}
          error={errors.logo}
        />
        {slugField}
        <SelectField
          id={id("type")}
          label="Clinic type"
          value={values.clinicType}
          onChange={(value) => set("clinicType", value)}
          options={TYPE_OPTIONS}
          error={errors.clinicType}
        />
        <SelectField
          id={id("status")}
          label="Status"
          value={values.status}
          onChange={(value) =>
            set("status", value === "INACTIVE" ? "INACTIVE" : "ACTIVE")
          }
          options={STATUS_OPTIONS}
          error={errors.status}
        />
        <SelectField
          id={id("timezone")}
          label="Time zone"
          value={values.timezone}
          onChange={(value) => set("timezone", value)}
          options={timezones}
          error={errors.timezone}
        />
      </FormSection>

      <FormSection title="Contact">
        <TextField
          id={id("email")}
          label="Clinic email (optional)"
          type="email"
          value={values.email}
          onChange={(value) => set("email", value)}
          error={errors.email}
          autoComplete="off"
          description="The clinic's official address. Not used to sign in."
        />
        <TextField
          id={id("phone")}
          label="Phone (optional)"
          type="tel"
          value={values.phone}
          onChange={(value) => set("phone", value)}
          error={errors.phone}
          autoComplete="off"
        />
      </FormSection>

      <FormSection title="Location">
        <TextField
          id={id("address")}
          label="Street address (optional)"
          value={values.address}
          onChange={(value) => set("address", value)}
          error={errors.address}
          autoComplete="off"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id={id("city")}
            label="City (optional)"
            value={values.city}
            onChange={(value) => set("city", value)}
            error={errors.city}
            autoComplete="off"
          />
          <TextField
            id={id("pin")}
            label="PIN code (optional)"
            value={values.pinCode}
            onChange={(value) => set("pinCode", value)}
            error={errors.pinCode}
            inputMode="numeric"
            maxLength={6}
            autoComplete="off"
          />
        </div>
        <SelectField
          id={id("state")}
          label="State (optional)"
          value={values.state}
          onChange={(value) => set("state", value)}
          options={STATE_OPTIONS}
          error={errors.state}
        />
      </FormSection>

      <FormSection title="Hours">
        {hours && (
          <div className="flex flex-col gap-3 rounded-btn bg-muted px-4 py-3 text-sm">
            <p>{hours.note}</p>
            <CheckboxField
              id={id("replace-hours")}
              label="Replace with simple hours"
              checked={hours.replace}
              onChange={hours.onReplace}
            />
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id={id("opening")}
            label="Opening time"
            type="time"
            value={values.openingTime}
            onChange={(value) => set("openingTime", value)}
            error={errors.openingTime}
            disabled={hoursLocked}
          />
          <TextField
            id={id("closing")}
            label="Closing time"
            type="time"
            value={values.closingTime}
            onChange={(value) => set("closingTime", value)}
            error={errors.closingTime}
            disabled={hoursLocked}
          />
        </div>
        <WorkingDaysField
          idPrefix={id("day")}
          days={values.workingDays}
          onChange={(days) => set("workingDays", days)}
          error={errors.workingDays}
          disabled={hoursLocked}
        />
      </FormSection>
    </>
  );
}

function WorkingDaysField({
  idPrefix,
  days,
  onChange,
  error,
  disabled,
}: {
  idPrefix: string;
  days: Weekday[];
  onChange: (days: Weekday[]) => void;
  error?: string;
  disabled: boolean;
}) {
  const errorId = `${idPrefix}-error`;
  return (
    <fieldset
      disabled={disabled}
      aria-describedby={error ? errorId : undefined}
      className="flex flex-col gap-2 disabled:opacity-60"
    >
      <legend className="mb-2 text-sm font-medium">Working days</legend>
      <div className="flex flex-wrap gap-2">
        {WEEKDAYS.map((day) => {
          const checked = days.includes(day);
          return (
            <label
              key={day}
              htmlFor={`${idPrefix}-${day}`}
              className={cn(
                "flex h-10 cursor-pointer items-center gap-2 rounded-btn border px-3 text-sm font-medium has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                checked
                  ? "border-brand bg-brand-tint text-brand"
                  : "border-input bg-card",
              )}
            >
              <input
                id={`${idPrefix}-${day}`}
                type="checkbox"
                checked={checked}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? WEEKDAYS.filter((d) => d === day || days.includes(d))
                      : days.filter((d) => d !== day),
                  )
                }
                aria-label={WEEKDAY_LABELS[day]}
                aria-invalid={error ? true : undefined}
                className="size-4 accent-brand"
              />
              <span aria-hidden>{WEEKDAY_LABELS[day].slice(0, 3)}</span>
            </label>
          );
        })}
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}

const ACCEPT = LOGO_CONTENT_TYPES.join(",");

function LogoField({
  id,
  name,
  currentUrl,
  choice,
  onChoice,
  error,
}: {
  id: string;
  name: string;
  currentUrl: string | null;
  choice: LogoChoice;
  onChoice: (choice: LogoChoice) => void;
  error?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const preview =
    choice.kind === "new"
      ? choice.upload.base64
      : choice.kind === "remove"
        ? null
        : currentUrl;
  const shownError = fileError ?? error;

  function pick(file: File | undefined) {
    setFileError(null);
    if (!file) return;
    const type = LOGO_CONTENT_TYPES.find((allowed) => allowed === file.type);
    if (!type) {
      setFileError("Use a PNG, JPG or WebP image.");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setFileError("The logo must be 512 KB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onChoice({
          kind: "new",
          upload: { contentType: type, base64: reader.result },
        });
      }
    };
    reader.onerror = () => setFileError("Couldn't read that file. Try again.");
    reader.readAsDataURL(file);
  }

  function remove() {
    setFileError(null);
    if (input.current) input.current.value = "";
    onChoice(currentUrl ? { kind: "remove" } : { kind: "keep" });
  }

  return (
    <div
      data-invalid={shownError ? true : undefined}
      className="flex flex-col gap-2"
    >
      <FieldLabel htmlFor={id}>Logo (optional)</FieldLabel>
      <div className="flex items-center gap-3">
        <ClinicAvatar name={name} logoUrl={preview} size={56} />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-btn px-3"
            onClick={() => input.current?.click()}
          >
            <ImageUpIcon aria-hidden />
            {preview ? "Replace" : "Upload"}
          </Button>
          {preview && (
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-btn px-3"
              onClick={remove}
            >
              <Trash2Icon aria-hidden />
              Remove
            </Button>
          )}
        </div>
        <input
          ref={input}
          id={id}
          type="file"
          accept={ACCEPT}
          aria-describedby={`${id}-description`}
          aria-invalid={shownError ? true : undefined}
          onChange={(event) => pick(event.target.files?.[0])}
          className="sr-only"
        />
      </div>
      <FieldDescription id={`${id}-description`}>
        PNG, JPG or WebP, up to 512 KB. Shown on the patient page.
      </FieldDescription>
      <FieldError>{shownError}</FieldError>
    </div>
  );
}
