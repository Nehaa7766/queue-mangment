"use client";

import { LoaderCircleIcon, PlusIcon, SendIcon, UsersIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { toast } from "sonner";
import {
  FormSheet,
  INVALID_FORM_MESSAGE,
  focusFirstInvalid,
} from "@/components/platform/form-kit";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
  MESSAGE_MAX_LENGTH,
  messageBodySchema,
  normalizeMessageBody,
  type BroadcastAudience,
} from "@/features/messaging/contracts";
import { cn } from "@/lib/utils";
import {
  ApiError,
  SEND_ERRORS,
  createBroadcast,
  fetchAudience,
  isRetryable,
  newAnnouncementKey,
} from "./announcements-api";
import { formatCount, oneLine, patientsLabel, servicesLabel } from "./format";
import { MessagePreview } from "./message-preview";

// How often the eligible count refreshes while the composer is open.
export const AUDIENCE_REFRESH_MS = 15_000;

type Scope = "all" | "chosen";
type AudienceService = BroadcastAudience["services"][number];
type Errors = { body?: string; services?: string };

// What the confirmation dialog shows and what Send then posts.
type Confirmation = {
  count: number;
  body: string;
  serviceIds: string[];
  serviceNames: string[];
};

const NO_SERVICE_CHOSEN =
  "Choose at least one service, or send to all services.";

// Fresh counts for the services in `update`, keeping services it leaves out.
function mergeServices(
  current: AudienceService[],
  update: AudienceService[],
): AudienceService[] {
  const byId = new Map(update.map((service) => [service.serviceId, service]));
  const merged = current.map(
    (service) => byId.get(service.serviceId) ?? service,
  );
  const known = new Set(current.map((service) => service.serviceId));
  return [
    ...merged,
    ...update.filter((service) => !known.has(service.serviceId)),
  ];
}

const OPTION_ROW =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-btn border border-border bg-card px-3 py-2 transition-colors hover:bg-accent has-checked:border-brand has-checked:bg-brand-tint has-disabled:cursor-not-allowed has-disabled:opacity-60 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50";
const OPTION_INPUT = "size-4 shrink-0 accent-brand focus-visible:outline-none";

// "New announcement": a side sheet with the text, who gets it, a live count
// of eligible patients and a preview, then a confirmation before sending.
// The draft and its idempotency key survive closing the sheet, so a retry
// after an error (or a double click) can never send a second copy.
export function AnnouncementComposer({
  open,
  onOpenChange,
  basePath,
  onListChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // The list page; the new announcement opens at `${basePath}/<id>`.
  basePath: string;
  // An earlier try turned out to be stored: the list should reload.
  onListChanged?: () => void;
}) {
  const router = useRouter();
  const formId = useId();
  const bodyId = `${formId}-body`;
  const countId = `${formId}-count`;
  const helpId = `${formId}-help`;

  const [text, setText] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [chosen, setChosen] = useState<string[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(false);
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  // One idempotency key per composer session: made on the first send,
  // reused by every retry, dropped once the server has stored it.
  const keyRef = useRef<string | null>(null);
  // Blocks a second send before React re-renders the disabled button.
  const sendingRef = useRef(false);

  // ---- Audience: the services and how many patients would get it ----

  const [services, setServices] = useState<AudienceService[]>([]);
  const [counted, setCounted] = useState<{
    key: string;
    eligible: number;
  } | null>(null);
  const [audienceFailed, setAudienceFailed] = useState(false);
  const audienceRequest = useRef(0);

  const chosenIds = services
    .filter((service) => chosen.includes(service.serviceId))
    .map((service) => service.serviceId);
  // What to count: "all", the chosen ids, or null when none is chosen yet.
  const audienceKey =
    scope === "all" ? "all" : chosenIds.length > 0 ? chosenIds.join(",") : null;

  // Returns the eligible count, or null when the request failed. Only the
  // latest request updates the screen.
  const loadAudience = useCallback(
    async (key: string): Promise<number | null> => {
      const request = ++audienceRequest.current;
      try {
        const audience = await fetchAudience(
          key === "all" ? [] : key.split(","),
        );
        if (request === audienceRequest.current) {
          setServices((current) =>
            key === "all"
              ? audience.services
              : mergeServices(current, audience.services),
          );
          setCounted({ key, eligible: audience.eligible });
          setAudienceFailed(false);
        }
        return audience.eligible;
      } catch {
        if (request === audienceRequest.current) setAudienceFailed(true);
        return null;
      }
    },
    [],
  );

  useEffect(() => {
    if (!open || audienceKey === null) return;
    // A short pause lets quick checkbox changes settle into one request.
    const soon = window.setTimeout(() => void loadAudience(audienceKey), 150);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible")
        void loadAudience(audienceKey);
    }, AUDIENCE_REFRESH_MS);
    return () => {
      window.clearTimeout(soon);
      window.clearInterval(timer);
    };
  }, [open, audienceKey, loadAudience]);

  const sum = (list: AudienceService[]) =>
    list.reduce((total, service) => total + service.eligible, 0);
  const allCount =
    counted?.key === "all"
      ? counted.eligible
      : services.length > 0
        ? sum(services)
        : null;
  // The server's count for this exact choice when it has answered, else the
  // per-service counts added up while it does.
  const eligible: number | null =
    audienceKey === null
      ? 0
      : counted?.key === audienceKey
        ? counted.eligible
        : scope === "all"
          ? allCount
          : sum(services.filter((s) => chosenIds.includes(s.serviceId)));

  // ---- Text ----

  const length = normalizeMessageBody(text).length;
  const over = length - MESSAGE_MAX_LENGTH;

  function validate(): Errors {
    const found: Errors = {};
    const body = messageBodySchema.safeParse(text);
    if (!body.success) found.body = body.error.issues[0]?.message;
    if (scope === "chosen" && chosenIds.length === 0) {
      found.services = NO_SERVICE_CHOSEN;
    }
    return found;
  }

  function resetDraft() {
    keyRef.current = null;
    setText("");
    setScope("all");
    setChosen([]);
    setErrors({});
    setFormError(null);
    setRetryable(false);
  }

  // ---- Send ----

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sendingRef.current || checking) return;
    const found = validate();
    setErrors(found);
    if (found.body || found.services) {
      setFormError(INVALID_FORM_MESSAGE);
      focusFirstInvalid(formId);
      return;
    }
    setFormError(null);
    // Count again right now, so the confirmation states the real number.
    setChecking(true);
    const fresh = audienceKey === null ? 0 : await loadAudience(audienceKey);
    setChecking(false);
    const count = fresh ?? eligible;
    if (count === null) {
      setFormError(SEND_ERRORS.network);
      return;
    }
    if (count === 0) {
      setFormError(SEND_ERRORS.noRecipients);
      return;
    }
    setConfirmation({
      count,
      body: text,
      serviceIds: scope === "all" ? [] : chosenIds,
      serviceNames:
        scope === "all"
          ? []
          : services
              .filter((service) => chosenIds.includes(service.serviceId))
              .map((service) => service.name),
    });
    setConfirmOpen(true);
  }

  async function errorMessage(
    error: unknown,
    sent: Confirmation,
  ): Promise<string> {
    if (!(error instanceof ApiError)) return SEND_ERRORS.generic;
    switch (error.code) {
      case "NETWORK_ERROR":
        return SEND_ERRORS.network;
      case "RATE_LIMITED":
        return SEND_ERRORS.rateLimited;
      case "IDEMPOTENCY_CONFLICT":
        // The key was used by an earlier try that got through. Sending
        // again from here is a new announcement, so it gets a new key.
        keyRef.current = null;
        onListChanged?.();
        return SEND_ERRORS.alreadySent;
      case "VALIDATION_ERROR": {
        // Usually everyone has been seen or left since the count.
        const count = await loadAudience(
          sent.serviceIds.length > 0 ? sent.serviceIds.join(",") : "all",
        );
        return count === 0 ? SEND_ERRORS.noRecipients : error.message;
      }
      default:
        return error.message || SEND_ERRORS.generic;
    }
  }

  async function send() {
    const sent = confirmation;
    if (!sent || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setConfirmOpen(false);
    setFormError(null);
    keyRef.current ??= newAnnouncementKey();
    try {
      const summary = await createBroadcast({
        idempotencyKey: keyRef.current,
        body: sent.body,
        serviceIds: sent.serviceIds,
      });
      resetDraft();
      onOpenChange(false);
      toast.success(`Sending to ${patientsLabel(summary.counts.total)}.`);
      router.push(`${basePath}/${summary.id}`);
    } catch (error) {
      setRetryable(isRetryable(error));
      setFormError(await errorMessage(error, sent));
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  const sendLabel = retryable ? "Try again" : "Send announcement";

  return (
    <FormSheet
      open={open}
      onOpenChange={(next) => {
        // Stay open until the server answers, so the result is seen.
        if (!next && sendingRef.current) return;
        if (!next) {
          // The draft and its key stay for next time; old messages don't.
          setErrors({});
          setFormError(null);
        }
        onOpenChange(next);
      }}
      trigger={
        <Button className="h-10 rounded-btn px-4 font-semibold">
          <PlusIcon aria-hidden />
          New announcement
        </Button>
      }
      title="New announcement"
      description="One message, sent privately to each patient waiting or called today."
      error={formError}
      footer={
        <>
          <Button
            variant="outline"
            className="h-10 rounded-btn px-4"
            disabled={sending}
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button
            type="submit"
            form={formId}
            disabled={sending || checking}
            className="h-10 rounded-btn px-4 font-semibold"
          >
            {sending ? (
              <>
                <LoaderCircleIcon
                  aria-hidden
                  className="motion-safe:animate-spin"
                />
                Sending…
              </>
            ) : checking ? (
              <>
                <LoaderCircleIcon
                  aria-hidden
                  className="motion-safe:animate-spin"
                />
                Counting patients…
              </>
            ) : (
              <>
                <SendIcon aria-hidden />
                {sendLabel}
              </>
            )}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        method="post"
        noValidate
        onSubmit={handleSubmit}
        className="flex flex-col gap-7"
      >
        <Field data-invalid={errors.body ? true : undefined}>
          <FieldLabel htmlFor={bodyId}>Message</FieldLabel>
          <Textarea
            id={bodyId}
            name="body"
            rows={5}
            value={text}
            disabled={sending}
            onChange={(event) => setText(event.target.value)}
            aria-invalid={errors.body || over > 0 ? true : undefined}
            aria-describedby={`${helpId} ${countId}`}
            className="max-h-72 min-h-32 text-base md:text-base"
          />
          <div className="flex items-start justify-between gap-3">
            <FieldDescription id={helpId}>
              Plain text. Patients can reply in their own chat.
            </FieldDescription>
            <p
              id={countId}
              className={cn(
                "shrink-0 text-xs tabular-nums",
                over > 0
                  ? "font-semibold text-danger-text"
                  : "text-muted-foreground",
              )}
            >
              <span aria-hidden>
                {`${formatCount(length)} / ${formatCount(MESSAGE_MAX_LENGTH)}`}
              </span>
              <span className="sr-only">
                {`${formatCount(length)} of ${formatCount(MESSAGE_MAX_LENGTH)} characters`}
              </span>
              {over > 0 && ` · ${formatCount(over)} over the limit`}
            </p>
          </div>
          <FieldError>{errors.body}</FieldError>
        </Field>

        <fieldset className="flex min-w-0 flex-col gap-3">
          <legend className="mb-1 text-sm font-medium">Who gets it</legend>
          <p className="-mt-1 text-xs text-muted-foreground">
            Patients waiting or called today. Each one gets a separate private
            message and can&apos;t see who else got it.
          </p>
          <div className="flex flex-col gap-2">
            <label className={OPTION_ROW}>
              <input
                type="radio"
                name="scope"
                value="all"
                checked={scope === "all"}
                disabled={sending}
                onChange={() => setScope("all")}
                className={OPTION_INPUT}
              />
              <span className="flex-1 text-sm font-medium">All services</span>
              {allCount !== null && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  <span className="sr-only">, </span>
                  {patientsLabel(allCount)}
                </span>
              )}
            </label>
            <label className={OPTION_ROW}>
              <input
                type="radio"
                name="scope"
                value="chosen"
                checked={scope === "chosen"}
                disabled={sending}
                onChange={() => setScope("chosen")}
                className={OPTION_INPUT}
              />
              <span className="flex-1 text-sm font-medium">
                Chosen services
              </span>
            </label>
          </div>

          {scope === "chosen" && (
            <fieldset className="flex min-w-0 flex-col gap-2 border-l-2 border-divider pl-3">
              <legend className="sr-only">Services</legend>
              {services.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {audienceFailed
                    ? "Couldn't load the services. Check the connection."
                    : "Loading services…"}
                </p>
              ) : (
                services.map((service) => (
                  <label key={service.serviceId} className={OPTION_ROW}>
                    <input
                      type="checkbox"
                      name="serviceIds"
                      value={service.serviceId}
                      checked={chosen.includes(service.serviceId)}
                      disabled={sending}
                      aria-invalid={errors.services ? true : undefined}
                      onChange={(event) => {
                        const { checked } = event.target;
                        setChosen((current) =>
                          checked
                            ? [...current, service.serviceId]
                            : current.filter((id) => id !== service.serviceId),
                        );
                        if (checked)
                          setErrors((e) => ({ ...e, services: undefined }));
                      }}
                      className={OPTION_INPUT}
                    />
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span
                        aria-hidden
                        className="rounded-sm bg-muted px-1.5 font-display text-xs font-extrabold"
                      >
                        {service.tokenPrefix}
                      </span>
                      <span className="truncate text-sm font-medium">
                        {service.name}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      <span className="sr-only">, </span>
                      {patientsLabel(service.eligible)}
                    </span>
                  </label>
                ))
              )}
              <FieldError>{errors.services}</FieldError>
            </fieldset>
          )}

          <div className="flex items-center gap-3 rounded-card border border-border bg-card px-4 py-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand">
              <UsersIcon aria-hidden className="size-5" />
            </span>
            <div className="min-w-0">
              <p aria-live="polite" className="text-sm">
                {eligible === null ? (
                  "Counting patients…"
                ) : (
                  <>
                    <span className="font-display text-xl font-bold tabular-nums">
                      {formatCount(eligible)}
                    </span>{" "}
                    {eligible === 1
                      ? "patient will get this"
                      : "patients will get this"}
                  </>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {audienceFailed
                  ? "Couldn't update the count. It will try again shortly."
                  : "Updates as patients join or are seen."}
              </p>
            </div>
          </div>
        </fieldset>

        <MessagePreview text={text} />
      </form>

      {/* Inside the sheet, so it nests in the sheet's focus trap. */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          {confirmation && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Send to {patientsLabel(confirmation.count)}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Each patient gets it as a separate private message in their
                  own reception chat. They can&apos;t see who else got it.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <dl className="flex flex-col gap-2 rounded-btn bg-muted px-3 py-2.5 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Services</dt>
                  <dd className="font-medium">
                    {servicesLabel(confirmation.serviceNames)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Message</dt>
                  <dd className="line-clamp-3 break-words">
                    {oneLine(confirmation.body)}
                  </dd>
                </div>
              </dl>
              <AlertDialogFooter>
                <AlertDialogCancel className="h-10 rounded-btn px-4">
                  Go back
                </AlertDialogCancel>
                <AlertDialogAction
                  className="h-10 rounded-btn px-4 font-semibold"
                  onClick={() => void send()}
                >
                  Send to {patientsLabel(confirmation.count)}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </FormSheet>
  );
}
