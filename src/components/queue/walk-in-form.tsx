"use client";

import { useId, useRef, useState, type FormEvent } from "react";
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
  API,
  type StaffQueueSummary,
  type StaffTokenResponse,
  type StaffTokenView,
} from "@/features/queue/contracts";
import { cn } from "@/lib/utils";
import { apiRequest, ApiError, newIdempotencyKey } from "./api-client";

const NAME_MAX = 80;

// Registers a walk-in patient. One idempotency key per attempt: a retry with
// the same details reuses it, so a double click or a flaky network never
// creates two tokens; changing the details starts a new attempt.
export function WalkInForm({
  queues,
  defaultQueueId,
  onCreated,
}: {
  queues: Pick<
    StaffQueueSummary,
    "queueId" | "serviceName" | "tokenPrefix" | "status"
  >[];
  defaultQueueId?: string;
  onCreated?: (token: StaffTokenView) => void;
}) {
  const formId = useId();
  const openQueues = queues.filter((queue) => queue.status === "OPEN");
  const [queueId, setQueueId] = useState(
    () =>
      openQueues.find((queue) => queue.queueId === defaultQueueId)?.queueId ??
      openQueues[0]?.queueId ??
      "",
  );
  const [patientName, setPatientName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const attempt = useRef<{ key: string; details: string } | null>(null);

  if (queues.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        There are no queues today, so walk-ins can&apos;t be registered yet.
      </p>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = patientName.trim();
    if (!name) {
      setNameError("Enter the patient's name or initials.");
      return;
    }
    if (!queueId) {
      setFormError("All queues are paused or closed.");
      return;
    }
    setNameError(null);
    setFormError(null);

    const details = `${queueId}:${name}`;
    if (attempt.current?.details !== details) {
      attempt.current = { key: newIdempotencyKey(), details };
    }

    setSubmitting(true);
    try {
      const { token } = await apiRequest<StaffTokenResponse>(
        API.walkIn(queueId),
        {
          method: "POST",
          body: { patientName: name },
          idempotencyKey: attempt.current.key,
        },
      );
      attempt.current = null;
      setPatientName("");
      toast.success(`Token ${token.tokenLabel} created for ${name}.`);
      onCreated?.(token);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Something went wrong. Please try again.";
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      method="post"
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-5"
    >
      <FieldSet>
        <FieldLegend variant="label">Service</FieldLegend>
        <div className="flex flex-wrap gap-2">
          {queues.map((queue) => {
            const disabled = queue.status !== "OPEN";
            const checked = queue.queueId === queueId;
            return (
              <label
                key={queue.queueId}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-2 rounded-btn border px-3.5 text-sm font-medium transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                  checked
                    ? "border-brand bg-brand text-white"
                    : "border-border bg-card hover:bg-accent",
                  disabled && "cursor-not-allowed opacity-60 hover:bg-card",
                )}
              >
                <input
                  type="radio"
                  name={`${formId}-queue`}
                  value={queue.queueId}
                  checked={checked}
                  disabled={disabled}
                  onChange={() => setQueueId(queue.queueId)}
                  className="sr-only"
                />
                <span className="font-display font-extrabold">
                  {queue.tokenPrefix}
                </span>
                {queue.serviceName}
                {disabled && (
                  <span className="text-xs">
                    ({queue.status === "PAUSED" ? "paused" : "closed"})
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </FieldSet>

      <Field data-invalid={nameError ? true : undefined}>
        <FieldLabel htmlFor={`${formId}-name`}>Patient name</FieldLabel>
        <Input
          id={`${formId}-name`}
          name="patientName"
          value={patientName}
          maxLength={NAME_MAX}
          autoComplete="off"
          aria-invalid={nameError ? true : undefined}
          aria-describedby={`${formId}-name-help`}
          onChange={(event) => setPatientName(event.target.value)}
          className="h-11"
        />
        <FieldDescription id={`${formId}-name-help`}>
          First name or initials only. No phone number needed.
        </FieldDescription>
        {nameError && <FieldError>{nameError}</FieldError>}
      </Field>

      {formError && <FieldError>{formError}</FieldError>}

      <Button
        type="submit"
        disabled={submitting}
        className="h-12 rounded-btn text-[15px] font-semibold"
      >
        {submitting ? "Registering…" : "Register walk-in"}
      </Button>
    </form>
  );
}
