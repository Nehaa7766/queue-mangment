"use client";

import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ApiError } from "@/components/queue/api-client";
import { formatClinicTime } from "@/components/queue/token-display";
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
import { Textarea } from "@/components/ui/textarea";
import {
  DOCTOR_AVAILABILITIES,
  MAX_DELAY_MINUTES,
  MAX_NOTE_LENGTH,
} from "@/features/doctor/availability";
import type { DoctorSelfView } from "@/features/doctor/contracts";
import type { DoctorAvailabilityStatus } from "@/features/queue/contracts";
import { cn } from "@/lib/utils";
import { AvailabilityBadge } from "./availability-badge";
import { saveAvailability } from "./availability-client";
import { AVAILABILITY_DISPLAY } from "./availability-display";

const DELAY_CHOICES = [0, 10, 15, 30, 45] as const;

// Full availability settings: status, announced delay and a short note that
// reception sees. Patients only ever see "on a short break" or "running late".
export function AvailabilityForm({
  initialDoctor,
  timezone,
  onSaved,
}: {
  initialDoctor: DoctorSelfView;
  timezone: string;
  onSaved?: (doctor: DoctorSelfView) => void;
}) {
  const formId = useId();
  const [saved, setSaved] = useState(initialDoctor);
  const [availability, setAvailability] = useState<DoctorAvailabilityStatus>(
    initialDoctor.availability,
  );
  const [delay, setDelay] = useState(String(initialDoctor.delayMinutes));
  const [note, setNote] = useState(initialDoctor.note ?? "");
  const [delayError, setDelayError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const offDuty = availability === "OFF_DUTY";
  const delayLabel =
    availability === "ON_BREAK"
      ? "How long is the break? (minutes)"
      : "How late are you running? (minutes)";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const minutes = offDuty ? 0 : Number(delay || "0");
    if (
      !Number.isInteger(minutes) ||
      minutes < 0 ||
      minutes > MAX_DELAY_MINUTES
    ) {
      setDelayError(`Enter whole minutes from 0 to ${MAX_DELAY_MINUTES}.`);
      return;
    }
    setDelayError(null);
    setFormError(null);
    setSaving(true);
    try {
      const doctor = await saveAvailability({
        availability,
        delayMinutes: minutes,
        note: note.trim() || null,
      });
      setSaved(doctor);
      setDelay(String(doctor.delayMinutes));
      toast.success(
        `You're now shown as ${AVAILABILITY_DISPLAY[doctor.availability].label.toLowerCase()}.`,
      );
      onSaved?.(doctor);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Something went wrong. Please try again.";
      setFormError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      method="post"
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-6"
    >
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>Now showing:</span>
        <AvailabilityBadge doctor={saved} />
        {saved.updatedAt && (
          <span className="tabular-nums">
            since {formatClinicTime(saved.updatedAt, timezone)}
          </span>
        )}
      </div>

      <FieldSet>
        <FieldLegend variant="label">Status</FieldLegend>
        <div className="grid gap-2 sm:grid-cols-3">
          {DOCTOR_AVAILABILITIES.map((option) => {
            const display = AVAILABILITY_DISPLAY[option];
            const checked = option === availability;
            return (
              <label
                key={option}
                className={cn(
                  "flex min-h-14 cursor-pointer flex-col gap-0.5 rounded-btn border px-4 py-3 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                  checked
                    ? "border-brand bg-brand text-white"
                    : "border-border bg-card hover:bg-accent",
                )}
              >
                <input
                  type="radio"
                  name={`${formId}-availability`}
                  value={option}
                  checked={checked}
                  onChange={() => setAvailability(option)}
                  className="sr-only"
                />
                <span className="font-semibold">{display.label}</span>
                <span
                  className={cn(
                    "text-xs",
                    checked ? "text-brand-muted" : "text-muted-foreground",
                  )}
                >
                  {display.description}
                </span>
              </label>
            );
          })}
        </div>
      </FieldSet>

      {!offDuty && (
        <Field data-invalid={delayError ? true : undefined}>
          <FieldLabel htmlFor={`${formId}-delay`}>{delayLabel}</FieldLabel>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id={`${formId}-delay`}
              inputMode="numeric"
              value={delay}
              aria-invalid={delayError ? true : undefined}
              aria-describedby={`${formId}-delay-help`}
              onChange={(event) =>
                setDelay(event.target.value.replace(/\D/g, "").slice(0, 3))
              }
              className="h-11 w-24 tabular-nums"
            />
            {DELAY_CHOICES.map((minutes) => (
              <Button
                key={minutes}
                type="button"
                variant="outline"
                aria-pressed={delay === String(minutes)}
                className={cn(
                  "h-11 rounded-btn px-3.5",
                  delay === String(minutes) &&
                    "border-brand bg-brand-tint text-brand hover:bg-brand-tint",
                )}
                onClick={() => setDelay(String(minutes))}
              >
                {minutes === 0 ? "None" : `${minutes} min`}
              </Button>
            ))}
          </div>
          <FieldDescription id={`${formId}-delay-help`}>
            {availability === "ON_BREAK"
              ? "Waiting patients see roughly when you'll be back."
              : "Waiting patients see that you're running late. Use 0 when you're on time."}
          </FieldDescription>
          {delayError && <FieldError>{delayError}</FieldError>}
        </Field>
      )}

      <Field>
        <FieldLabel htmlFor={`${formId}-note`}>
          Note for reception (optional)
        </FieldLabel>
        <Textarea
          id={`${formId}-note`}
          value={note}
          maxLength={MAX_NOTE_LENGTH}
          rows={2}
          aria-describedby={`${formId}-note-help`}
          onChange={(event) => setNote(event.target.value)}
        />
        <FieldDescription id={`${formId}-note-help`}>
          Only reception sees this, never patients. No patient details.{" "}
          {note.length}/{MAX_NOTE_LENGTH}
        </FieldDescription>
      </Field>

      {formError && <FieldError>{formError}</FieldError>}

      <Button
        type="submit"
        disabled={saving}
        className="h-12 rounded-btn text-[15px] font-semibold sm:w-fit sm:px-8"
      >
        {saving ? "Saving…" : "Save availability"}
      </Button>
    </form>
  );
}
