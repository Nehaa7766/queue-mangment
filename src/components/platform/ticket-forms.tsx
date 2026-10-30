"use client";

import { PencilIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  SUPPORT_STATUSES,
  SUPPORT_STATUS_LABELS,
  supportTicketAdminCreateSchema,
  supportTicketEditSchema,
} from "@/features/platform/schemas";
import type { SupportTicketStatus } from "@/generated/prisma/enums";
import {
  fieldErrors,
  focusFirstInvalid,
  INVALID_FORM_MESSAGE,
  FormSheet,
  SelectField,
  TextAreaField,
  TextField,
  type FieldErrors,
} from "./form-kit";
import { IconAction } from "./icon-action";
import { errorMessage, requestJson } from "./request";
import { useHydrated } from "./use-hydrated";

type Values = {
  clinicId: string;
  subject: string;
  body: string;
  status: SupportTicketStatus;
};

const STATUS_OPTIONS = SUPPORT_STATUSES.map((status) => ({
  value: status,
  label: SUPPORT_STATUS_LABELS[status],
}));

// Open a ticket on a clinic's behalf (no `ticket`) or edit one.
export function TicketFormButton({
  ticket,
  clinics = [],
}: {
  ticket?: {
    id: string;
    subject: string;
    body: string;
    status: SupportTicketStatus;
    clinicName: string | null;
  };
  // For the clinic picker when opening a ticket.
  clinics?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const formId = useId();
  const hydrated = useHydrated();
  const initial: Values = {
    clinicId: "",
    subject: ticket?.subject ?? "",
    body: ticket?.body ?? "",
    status: ticket?.status ?? "OPEN",
  };
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Values>(initial);
  const [errors, setErrors] = useState<FieldErrors<keyof Values>>({});
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const set = (key: keyof Values) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = ticket
      ? supportTicketEditSchema.safeParse(values)
      : supportTicketAdminCreateSchema.safeParse({
          ...values,
          clinicId: values.clinicId || null,
        });
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
      await requestJson(
        ticket ? `/api/platform/support/${ticket.id}` : "/api/platform/support",
        { method: ticket ? "PUT" : "POST", body: parsed.data },
      );
      toast.success(ticket ? "Ticket saved." : "Ticket opened.");
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
        ticket ? (
          <IconAction
            icon={PencilIcon}
            label={`Edit ticket ${ticket.subject}`}
            tip="Edit"
          />
        ) : (
          <Button className="h-9 rounded-btn px-4 font-semibold">
            <PlusIcon aria-hidden />
            New ticket
          </Button>
        )
      }
      title={ticket ? "Edit ticket" : "Open a ticket"}
      description={
        ticket
          ? ticket.clinicName
            ? `From ${ticket.clinicName}.`
            : "Not linked to a clinic."
          : "For example after a phone call from a clinic."
      }
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
            {pending ? "Saving…" : ticket ? "Save changes" : "Open ticket"}
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
        {!ticket && (
          <SelectField
            id={`${formId}-clinic`}
            label="Clinic"
            value={values.clinicId}
            onChange={set("clinicId")}
            error={errors.clinicId}
            options={[
              { value: "", label: "No clinic (platform question)" },
              ...clinics.map((clinic) => ({
                value: clinic.id,
                label: clinic.name,
              })),
            ]}
          />
        )}
        <TextField
          id={`${formId}-subject`}
          label="Subject"
          value={values.subject}
          onChange={set("subject")}
          error={errors.subject}
        />
        <TextAreaField
          id={`${formId}-body`}
          label="Details"
          value={values.body}
          onChange={set("body")}
          error={errors.body}
          rows={6}
        />
        <SelectField
          id={`${formId}-status`}
          label="Status"
          value={values.status}
          onChange={set("status")}
          error={errors.status}
          options={STATUS_OPTIONS}
        />
      </form>
    </FormSheet>
  );
}
