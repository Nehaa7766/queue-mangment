"use client";

import { KeyRoundIcon, PencilIcon, UserPlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  adminCreateSchema,
  userInputSchema,
} from "@/features/platform/schemas";
import type { AdminCreateResult } from "@/features/platform/users";
import {
  fieldErrors,
  focusFirstInvalid,
  INVALID_FORM_MESSAGE,
  FormSheet,
  SelectField,
  TextField,
  type FieldErrors,
} from "./form-kit";
import { IconAction } from "./icon-action";
import { InviteLink } from "./invite-link";
import { errorMessage, requestJson } from "./request";
import { useHydrated } from "./use-hydrated";

type UserValues = { name: string; email: string };

// Edit any user's name and email (row action).
export function EditUserButton({
  user,
}: {
  user: { id: string; name: string; email: string };
}) {
  const router = useRouter();
  const formId = useId();
  const hydrated = useHydrated();
  const initial: UserValues = { name: user.name, email: user.email };
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<UserValues>(initial);
  const [errors, setErrors] = useState<FieldErrors<keyof UserValues>>({});
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = userInputSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setFormError(INVALID_FORM_MESSAGE);
      focusFirstInvalid(formId);
      return;
    }
    setErrors({});
    setFormError(null);
    setPending(true);
    try {
      await requestJson(`/api/platform/users/${user.id}`, {
        method: "PUT",
        body: parsed.data,
      });
      toast.success("User saved.");
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
          setValues(initial);
          setErrors({});
          setFormError(null);
        }
      }}
      trigger={
        <IconAction icon={PencilIcon} label={`Edit ${user.name}`} tip="Edit" />
      }
      title={`Edit ${user.name}`}
      description="Clinic staff are added from each clinic's own Staff page."
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
        className="flex flex-col gap-4"
      >
        <TextField
          id={`${formId}-name`}
          label="Name"
          value={values.name}
          onChange={(name) => setValues((current) => ({ ...current, name }))}
          error={errors.name}
          autoComplete="off"
        />
        <TextField
          id={`${formId}-email`}
          label="Email"
          type="email"
          value={values.email}
          onChange={(email) => setValues((current) => ({ ...current, email }))}
          error={errors.email}
          autoComplete="off"
        />
      </form>
    </FormSheet>
  );
}

type AdminValues = { name: string; email: string; clinicId: string };

// Add a clinic admin. Each admin then adds their own staff from the clinic's
// Staff page. On a clinic's page pass `clinicId` to fix the clinic.
export function AddAdminButton({
  clinics,
  clinicId,
}: {
  clinics: { id: string; name: string }[];
  clinicId?: string;
}) {
  const router = useRouter();
  const formId = useId();
  const hydrated = useHydrated();
  const initial: AdminValues = {
    name: "",
    email: "",
    // With only one clinic to choose from, it is chosen already.
    clinicId: clinicId ?? (clinics.length === 1 ? clinics[0].id : ""),
  };
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<AdminValues>(initial);
  const [errors, setErrors] = useState<FieldErrors<keyof AdminValues>>({});
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<AdminCreateResult | null>(null);
  const fixedClinic = clinicId
    ? clinics.find((clinic) => clinic.id === clinicId)
    : undefined;

  const set = (key: keyof AdminValues) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = adminCreateSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setFormError(INVALID_FORM_MESSAGE);
      focusFirstInvalid(formId);
      return;
    }
    setErrors({});
    setFormError(null);
    setPending(true);
    try {
      const added = await requestJson<AdminCreateResult>(
        "/api/platform/users",
        { method: "POST", body: parsed.data },
      );
      // The sheet shows the result. No toast: it would sit over the
      // sheet's footer buttons.
      setResult(added);
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
          setValues(initial);
          setErrors({});
          setFormError(null);
          setResult(null);
        }
      }}
      trigger={
        <Button className="h-9 rounded-btn px-4 font-semibold">
          <UserPlusIcon aria-hidden />
          Add admin
        </Button>
      }
      title={result ? "Admin added" : "Add a clinic admin"}
      description={
        result
          ? undefined
          : "Clinic admins run their clinic and add their own reception and doctors."
      }
      footer={
        result ? (
          <Button
            className="h-10 rounded-btn px-4"
            onClick={() => setOpen(false)}
          >
            Done
          </Button>
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
              {pending ? "Adding…" : "Add admin"}
            </Button>
          </>
        )
      }
    >
      {result ? (
        result.kind === "added" ? (
          <p role="status" className="text-sm">
            <span className="font-semibold">{result.email}</span> already had a
            QueueCare account and is now an admin at{" "}
            <span className="font-semibold">{result.clinicName}</span>.
          </p>
        ) : (
          <InviteLink email={result.email} url={result.acceptUrl} />
        )
      ) : (
        <form
          id={formId}
          method="post"
          noValidate
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          {fixedClinic ? (
            <p className="text-sm">
              Clinic: <span className="font-semibold">{fixedClinic.name}</span>
            </p>
          ) : (
            <SelectField
              id={`${formId}-clinic`}
              label="Clinic"
              value={values.clinicId}
              onChange={set("clinicId")}
              options={[
                { value: "", label: "Choose a clinic" },
                ...clinics.map((clinic) => ({
                  value: clinic.id,
                  label: clinic.name,
                })),
              ]}
              error={errors.clinicId}
            />
          )}
          <TextField
            id={`${formId}-name`}
            label="Name"
            value={values.name}
            onChange={set("name")}
            error={errors.name}
            autoComplete="off"
          />
          <TextField
            id={`${formId}-email`}
            label="Email"
            type="email"
            value={values.email}
            onChange={set("email")}
            error={errors.email}
            autoComplete="off"
            description="A new address gets an invitation email with a link to set a password. An existing account is added straight away."
          />
        </form>
      )}
    </FormSheet>
  );
}

// Emails the user a link to choose a new password (row action).
export function SendResetButton({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const [pending, setPending] = useState(false);
  return (
    <IconAction
      icon={KeyRoundIcon}
      label={`Send password reset to ${userName}`}
      tip="Send password reset"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await requestJson(`/api/platform/users/${userId}/password-reset`, {
            method: "POST",
          });
          toast.success(`We emailed ${userName} a password reset link.`);
        } catch (error) {
          toast.error(errorMessage(error));
        } finally {
          setPending(false);
        }
      }}
    />
  );
}
