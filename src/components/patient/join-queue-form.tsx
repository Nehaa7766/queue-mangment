"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
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
  joinQueueBodySchema,
  type PublicServiceView,
} from "@/features/queue/contracts";
import { joinQueue, type ApiFailureCode } from "./api-client";
import { formatEta } from "./format";
import { clearJoinKey, getOrCreateJoinKey } from "./join-key";
import { messages } from "./messages";
import { PatientBody, PatientStat, PatientStrip } from "./patient-page";
import { QueueStatusPill } from "./status-pill";

const m = messages.join;

// Failures where the request may or may not have reached the server. Keep the
// key so a retry returns the same token instead of creating a second one.
const UNCERTAIN: ReadonlySet<ApiFailureCode> = new Set([
  "NETWORK_ERROR",
  "INTERNAL_ERROR",
]);

function errorMessage(code: ApiFailureCode): string {
  return code in m.errors
    ? m.errors[code as keyof typeof m.errors]
    : m.errors.default;
}

type JoinableService = PublicServiceView & {
  queue: NonNullable<PublicServiceView["queue"]>;
};

export function JoinQueueForm({
  clinicSlug,
  clinicName,
  clinicOpen,
  service,
}: {
  clinicSlug: string;
  clinicName: string;
  clinicOpen: boolean;
  service: JoinableService;
}) {
  const router = useRouter();
  const queueId = service.queue.queueId;
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // State updates are async; the ref blocks a second tap in the same tick.
  const submittingRef = useRef(false);

  // The key exists from the moment the confirmation opens.
  useEffect(() => {
    getOrCreateJoinKey(queueId);
  }, [queueId]);

  const blockedReason = !clinicOpen
    ? m.clinicClosedNotice
    : service.queue.status === "PAUSED"
      ? m.pausedNotice
      : service.queue.status === "CLOSED"
        ? m.closedNotice
        : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || blockedReason) {
      return;
    }

    const trimmed = name.trim();
    const parsed = joinQueueBodySchema.safeParse({
      patientName: trimmed === "" ? undefined : trimmed,
    });
    if (!parsed.success) {
      setNameError(m.nameTooLong);
      return;
    }
    setNameError(null);
    setFormError(null);

    submittingRef.current = true;
    setSubmitting(true);
    const result = await joinQueue(
      queueId,
      parsed.data,
      getOrCreateJoinKey(queueId),
    );

    if (result.ok) {
      clearJoinKey(queueId);
      router.push(`/token/${result.data.token.publicTokenId}`);
      return;
    }
    if (!UNCERTAIN.has(result.code)) {
      clearJoinKey(queueId);
    }
    setFormError(errorMessage(result.code));
    submittingRef.current = false;
    setSubmitting(false);
  }

  return (
    <>
      <PatientStrip eyebrow={clinicName} title={m.title} />
      <PatientBody>
        <section
          aria-label={service.name}
          className="flex flex-col gap-4 rounded-card border border-border bg-card p-5 shadow-card"
        >
          <div className="flex items-center gap-3.5">
            <span
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-btn bg-brand-tint font-display text-lg font-extrabold text-brand"
            >
              {service.tokenPrefix}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-base font-semibold">{service.name}</span>
              {service.description && (
                <span className="text-sm text-muted-foreground">
                  {service.description}
                </span>
              )}
            </div>
            <QueueStatusPill status={service.queue.status} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <PatientStat
              label={m.peopleWaiting}
              value={service.queue.waitingCount}
            />
            <PatientStat
              label={m.currentWait}
              value={formatEta(service.queue.estimate)}
              note={
                service.queue.estimate.isRough
                  ? messages.token.roughEstimate
                  : undefined
              }
            />
          </div>
        </section>

        {blockedReason && (
          <Alert className="rounded-card border-border bg-status-off p-4 text-status-off-foreground">
            <AlertDescription className="text-base text-status-off-foreground">
              {blockedReason}
            </AlertDescription>
          </Alert>
        )}

        <form
          method="post"
          noValidate
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 rounded-card border border-border bg-card p-5 shadow-card"
          aria-busy={submitting}
        >
          <h2 className="text-base font-semibold">{m.detailsHeading}</h2>
          <Field data-invalid={nameError ? true : undefined}>
            <FieldLabel htmlFor="patient-name" className="text-base">
              {m.nameLabel}
            </FieldLabel>
            <Input
              id="patient-name"
              name="patientName"
              autoComplete="given-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={
                nameError
                  ? "patient-name-hint patient-name-error"
                  : "patient-name-hint"
              }
              disabled={submitting || blockedReason !== null}
              className="h-12 rounded-btn text-base md:text-base"
            />
            <FieldDescription id="patient-name-hint" className="text-sm">
              {m.nameHint}
            </FieldDescription>
            {nameError && (
              <FieldError id="patient-name-error">{nameError}</FieldError>
            )}
          </Field>

          <p className="flex gap-3 rounded-card bg-muted p-4 text-sm text-foreground">
            <ShieldCheck
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-brand"
            />
            {m.privacy}
          </p>

          {formError && (
            <Alert variant="destructive" className="rounded-card p-4">
              <AlertDescription className="text-base">
                {formError}
              </AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            disabled={submitting || blockedReason !== null}
            className="h-14 w-full rounded-btn text-base font-semibold"
          >
            {submitting ? m.submitting : m.submit}
          </Button>
        </form>

        <Link
          href={`/q/${clinicSlug}`}
          className="flex min-h-12 items-center justify-center rounded-btn text-base font-medium text-brand underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {m.back}
        </Link>
      </PatientBody>
    </>
  );
}
