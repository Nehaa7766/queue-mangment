"use client";

import { PencilIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DEFAULT_TIMEZONE,
  TIMEZONE_OPTIONS,
} from "@/features/onboarding/signup-schema";
import { suggestSlug } from "@/features/onboarding/slug";
import type {
  ClinicCreateResult,
  ClinicRow,
} from "@/features/platform/clinics";
import {
  clinicCreateSchema,
  clinicDetailsSchema,
} from "@/features/platform/schemas";
import { cn } from "@/lib/utils";
import {
  ClinicProfileFields,
  DEFAULT_HOURS,
  profileBody,
  type LogoChoice,
  type ProfileErrors,
  type ProfileValues,
} from "./clinic-profile-fields";
import {
  fieldErrors,
  focusFirstInvalid,
  FormSection,
  FormSheet,
  INVALID_FORM_MESSAGE,
  TextField,
  type FieldErrors,
} from "./form-kit";
import { DeleteButton } from "./delete-button";
import { IconAction } from "./icon-action";
import { InviteLink } from "./invite-link";
import { errorMessage, requestJson } from "./request";
import { useHydrated } from "./use-hydrated";

type SlugStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "taken"; reason: string };

// Asks the server whether an address is free, a moment after typing stops.
function useSlugCheck(slug: string, exceptClinicId?: string): SlugStatus {
  const [status, setStatus] = useState<SlugStatus>({ state: "idle" });
  useEffect(() => {
    if (slug.trim().length < 3) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      setStatus({ state: "checking" });
      const query = new URLSearchParams({ slug });
      if (exceptClinicId) query.set("except", exceptClinicId);
      try {
        const result = await requestJson<{
          available: boolean;
          reason?: string;
        }>(`/api/platform/clinics/slug?${query}`);
        if (cancelled) return;
        setStatus(
          result.available
            ? { state: "available" }
            : { state: "taken", reason: result.reason ?? "Not available." },
        );
      } catch {
        if (!cancelled) setStatus({ state: "idle" });
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slug, exceptClinicId]);
  return slug.trim().length < 3 ? { state: "idle" } : status;
}

function SlugHint({ status, slug }: { status: SlugStatus; slug: string }) {
  if (status.state === "checking") return <>Checking /q/{slug}…</>;
  if (status.state === "available") {
    return (
      <span className="text-status-done-foreground">
        /q/{slug} is available.
      </span>
    );
  }
  if (status.state === "taken") {
    return <span className="text-danger-text">{status.reason}</span>;
  }
  return <>The clinic&apos;s public page and QR code: /q/your-address.</>;
}

const TIMEZONES = TIMEZONE_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
}));

// ---- Add ----

type CreateValues = ProfileValues & {
  serviceName: string;
  tokenPrefix: string;
  adminName: string;
  adminEmail: string;
};

const EMPTY_CREATE: CreateValues = {
  name: "",
  slug: "",
  timezone: DEFAULT_TIMEZONE,
  status: "ACTIVE",
  // Same default as the database, so a fresh form isn't blocked by it.
  clinicType: "GENERAL",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  pinCode: "",
  ...DEFAULT_HOURS,
  serviceName: "General",
  tokenPrefix: "A",
  adminName: "",
  adminEmail: "",
};

export function AddClinicButton() {
  const router = useRouter();
  const formId = useId();
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<CreateValues>(EMPTY_CREATE);
  const [logo, setLogo] = useState<LogoChoice>({ kind: "keep" });
  // The address follows the name until someone edits it by hand.
  const [slugEdited, setSlugEdited] = useState(false);
  const [errors, setErrors] = useState<
    FieldErrors<keyof CreateValues | "logo">
  >({});
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<ClinicCreateResult | null>(null);
  const slugStatus = useSlugCheck(values.slug);

  function set<K extends keyof CreateValues>(key: K, value: CreateValues[K]) {
    setValues((current) => ({
      ...current,
      [key]: value,
      ...(key === "name" &&
        !slugEdited && { slug: suggestSlug(String(value)) }),
    }));
  }

  // The shared profile fields only know their own keys.
  function setProfile<K extends keyof ProfileValues>(
    key: K,
    value: ProfileValues[K],
  ) {
    set(key, value as CreateValues[K]);
  }

  function reset() {
    setValues(EMPTY_CREATE);
    setLogo({ kind: "keep" });
    setSlugEdited(false);
    setErrors({});
    setFormError(null);
    setResult(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { serviceName, tokenPrefix, adminName, adminEmail, ...profile } =
      values;
    const parsed = clinicCreateSchema.safeParse({
      ...profileBody(profile, logo, true),
      serviceName,
      tokenPrefix,
      adminName,
      adminEmail,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error, ["hours"]));
      setFormError(INVALID_FORM_MESSAGE);
      focusFirstInvalid(formId);
      return;
    }
    setErrors({});
    setFormError(null);
    setPending(true);
    try {
      const created = await requestJson<ClinicCreateResult>(
        "/api/platform/clinics",
        { method: "POST", body: parsed.data },
      );
      // The sheet shows the result. No toast: it would sit over the
      // sheet's footer buttons.
      setResult(created);
      router.refresh();
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <FormSheet
      open={open}
      error={formError}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
      trigger={
        <Button className="h-9 rounded-btn px-4 font-semibold">
          <PlusIcon aria-hidden />
          Add clinic
        </Button>
      }
      title={result ? "Clinic added" : "Add a clinic"}
      description={
        result
          ? undefined
          : "Active clinics get their public page and QR code at once."
      }
      footer={
        result ? (
          <>
            <Link
              href={`/super-admin/clinics/${result.clinicId}`}
              onClick={() => setOpen(false)}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-10 rounded-btn px-4",
              )}
            >
              Open clinic
            </Link>
            <Button
              className="h-10 rounded-btn px-4"
              onClick={() => setOpen(false)}
            >
              Done
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              className="h-10 rounded-btn px-4"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form={formId}
              disabled={pending || !hydrated}
              className="h-10 rounded-btn px-4 font-semibold"
            >
              {pending ? "Adding…" : "Add clinic"}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <CreatedSummary result={result} />
      ) : (
        <form
          id={formId}
          method="post"
          noValidate
          onSubmit={handleSubmit}
          className="flex flex-col gap-7"
        >
          <ClinicProfileFields
            idPrefix="clinic"
            values={values}
            set={setProfile}
            errors={errors}
            timezones={TIMEZONES}
            logo={{ currentUrl: null, choice: logo, onChoice: setLogo }}
            slugField={
              <TextField
                id="clinic-slug"
                label="Public address"
                value={values.slug}
                onChange={(value) => {
                  setSlugEdited(true);
                  set("slug", value);
                }}
                error={errors.slug}
                description={
                  <SlugHint status={slugStatus} slug={values.slug} />
                }
                autoCapitalize="none"
                spellCheck={false}
              />
            }
          />

          <FormSection title="First service">
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <TextField
                id="service-name"
                label="Service name"
                value={values.serviceName}
                onChange={(value) => set("serviceName", value)}
                error={errors.serviceName}
              />
              <TextField
                id="service-prefix"
                label="Token prefix"
                value={values.tokenPrefix}
                onChange={(value) => set("tokenPrefix", value.toUpperCase())}
                error={errors.tokenPrefix}
                maxLength={3}
                autoCapitalize="characters"
              />
            </div>
          </FormSection>

          <FormSection title="First clinic admin">
            <TextField
              id="admin-name"
              label="Name"
              value={values.adminName}
              onChange={(value) => set("adminName", value)}
              error={errors.adminName}
              autoComplete="off"
            />
            <TextField
              id="admin-email"
              label="Email"
              type="email"
              value={values.adminEmail}
              onChange={(value) => set("adminEmail", value)}
              error={errors.adminEmail}
              autoComplete="off"
              description="They get an invitation to set their password. If the email already has a QueueCare account, they're added straight away."
            />
          </FormSection>
        </form>
      )}
    </FormSheet>
  );
}

function CreatedSummary({ result }: { result: ClinicCreateResult }) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <p role="status">
        The clinic is live at{" "}
        <span className="font-mono font-semibold">/q/{result.slug}</span>.
      </p>
      {result.admin.kind === "added" ? (
        <p role="status">
          <span className="font-semibold">{result.admin.email}</span> already
          had a QueueCare account and is now this clinic&apos;s admin.
        </p>
      ) : (
        <InviteLink email={result.admin.email} url={result.admin.acceptUrl} />
      )}
    </div>
  );
}

// ---- Edit ----

export type EditableClinic = Pick<
  ClinicRow,
  | "id"
  | "name"
  | "slug"
  | "timezone"
  | "status"
  | "clinicType"
  | "email"
  | "phone"
  | "address"
  | "city"
  | "state"
  | "pinCode"
  | "hours"
  | "logoUrl"
  | "hasPatientHistory"
>;

function editValues(clinic: EditableClinic): ProfileValues {
  const hours =
    clinic.hours.kind === "simple" ? clinic.hours.hours : DEFAULT_HOURS;
  return {
    name: clinic.name,
    slug: clinic.slug,
    timezone: clinic.timezone,
    status: clinic.status,
    clinicType: clinic.clinicType,
    email: clinic.email ?? "",
    phone: clinic.phone ?? "",
    address: clinic.address ?? "",
    city: clinic.city ?? "",
    state: clinic.state ?? "",
    pinCode: clinic.pinCode ?? "",
    openingTime: hours.openingTime,
    closingTime: hours.closingTime,
    workingDays: [...hours.workingDays],
  };
}

export function EditClinicButton({
  clinic,
  compact = false,
}: {
  clinic: EditableClinic;
  compact?: boolean;
}) {
  const router = useRouter();
  const formId = useId();
  const hydrated = useHydrated();
  const simple = clinic.hours.kind === "simple";
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<ProfileValues>(() => editValues(clinic));
  const [logo, setLogo] = useState<LogoChoice>({ kind: "keep" });
  // Custom (or no) hours stay as they are unless replaced on purpose.
  const [replaceHours, setReplaceHours] = useState(simple);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const slugStatus = useSlugCheck(
    values.slug === clinic.slug ? "" : values.slug,
    clinic.id,
  );
  // Known zones plus whatever the clinic already uses.
  const timezones = TIMEZONES.some((zone) => zone.value === clinic.timezone)
    ? TIMEZONES
    : [{ value: clinic.timezone, label: clinic.timezone }, ...TIMEZONES];

  function set<K extends keyof ProfileValues>(key: K, value: ProfileValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = clinicDetailsSchema.safeParse(
      profileBody(values, logo, replaceHours),
    );
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error, ["hours"]));
      setFormError(INVALID_FORM_MESSAGE);
      focusFirstInvalid(formId);
      return;
    }
    setErrors({});
    setFormError(null);
    setPending(true);
    try {
      await requestJson(`/api/platform/clinics/${clinic.id}`, {
        method: "PUT",
        body: parsed.data,
      });
      toast.success("Clinic saved.");
      setOpen(false);
      router.refresh();
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <FormSheet
      open={open}
      error={formError}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setValues(editValues(clinic));
          setLogo({ kind: "keep" });
          setReplaceHours(simple);
          setErrors({});
          setFormError(null);
        }
      }}
      trigger={
        compact ? (
          <IconAction
            icon={PencilIcon}
            label={`Edit ${clinic.name}`}
            tip="Edit"
          />
        ) : (
          <Button variant="outline" className="h-10 rounded-btn px-4">
            <PencilIcon aria-hidden />
            Edit
            <span className="sr-only"> {clinic.name}</span>
          </Button>
        )
      }
      title={`Edit ${clinic.name}`}
      footer={
        <>
          <Button
            variant="outline"
            className="h-10 rounded-btn px-4"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            disabled={pending || !hydrated}
            className="h-10 rounded-btn px-4 font-semibold"
          >
            {pending ? "Saving…" : "Save changes"}
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
        <ClinicProfileFields
          idPrefix={formId}
          values={values}
          set={set}
          errors={errors}
          timezones={timezones}
          logo={{
            currentUrl: clinic.logoUrl,
            choice: logo,
            onChoice: setLogo,
          }}
          hours={
            simple
              ? undefined
              : {
                  note:
                    clinic.hours.kind === "custom"
                      ? "This clinic has custom hours (set in clinic settings). They stay as they are."
                      : "This clinic has no opening hours yet.",
                  replace: replaceHours,
                  onReplace: setReplaceHours,
                }
          }
          slugField={
            <TextField
              id={`${formId}-slug`}
              label="Public address"
              value={values.slug}
              onChange={(value) => set("slug", value)}
              error={errors.slug}
              disabled={clinic.hasPatientHistory}
              autoCapitalize="none"
              spellCheck={false}
              description={
                clinic.hasPatientHistory ? (
                  "This clinic has served patients, so its address stays: printed QR codes use it."
                ) : values.slug === clinic.slug ? (
                  "Changing it changes the public page and QR code."
                ) : (
                  <SlugHint status={slugStatus} slug={values.slug} />
                )
              }
            />
          }
        />
      </form>
    </FormSheet>
  );
}

// ---- Delete ----

export function DeleteClinicButton({
  clinic,
  redirectTo,
  compact = false,
}: {
  clinic: {
    id: string;
    name: string;
    slug: string;
    hasPatientHistory: boolean;
  };
  redirectTo?: string;
  compact?: boolean;
}) {
  return (
    <DeleteButton
      url={`/api/platform/clinics/${clinic.id}`}
      itemName={clinic.name}
      description="This permanently removes the clinic with its services, queues, settings and staff access. Staff who work at no other clinic are deactivated. Support tickets are kept."
      blockedReason={
        clinic.hasPatientHistory
          ? "Has patient history. Suspend instead."
          : null
      }
      confirmText={clinic.slug}
      successMessage={`${clinic.name} was deleted.`}
      redirectTo={redirectTo}
      compact={compact}
    />
  );
}
