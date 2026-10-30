"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  serviceInputSchema,
  type AdminServiceView,
} from "@/features/services/schemas";
import { adminRequest, errorMessage } from "./admin-api";
import { AdminSection, Pill } from "./admin-ui";

type FormValues = {
  name: string;
  description: string;
  tokenPrefix: string;
  estimatedDurationMinutes: string;
};

type FormErrors = Partial<Record<keyof FormValues | "form", string>>;

const EMPTY: FormValues = {
  name: "",
  description: "",
  tokenPrefix: "",
  estimatedDurationMinutes: "10",
};

// Client-side check with the same schema the API uses.
export function validateServiceForm(values: FormValues) {
  const result = serviceInputSchema.safeParse({
    name: values.name,
    description: values.description,
    tokenPrefix: values.tokenPrefix,
    estimatedDurationMinutes: Number(values.estimatedDurationMinutes),
  });
  if (result.success) return { data: result.data, errors: {} as FormErrors };
  const errors: FormErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof FormValues;
    errors[key] ??=
      key === "estimatedDurationMinutes"
        ? "Enter minutes between 1 and 240."
        : issue.message;
  }
  return { data: null, errors };
}

function ServiceForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial: FormValues;
  submitLabel: string;
  onSubmit: (
    data: NonNullable<ReturnType<typeof validateServiceForm>["data"]>,
  ) => Promise<void>;
}) {
  const id = useId();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<FormErrors>({});
  const [pending, setPending] = useState(false);

  const set = (key: keyof FormValues) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { data, errors: found } = validateServiceForm(values);
    setErrors(found);
    if (!data) return;
    setPending(true);
    try {
      await onSubmit(data);
      setValues(initial);
    } catch (error) {
      setErrors({ form: errorMessage(error) });
    } finally {
      setPending(false);
    }
  }

  const field = (
    key: keyof FormValues,
    label: string,
    input: React.ReactNode,
    help?: string,
  ) => (
    <Field data-invalid={errors[key] ? true : undefined}>
      <FieldLabel htmlFor={`${id}-${key}`}>{label}</FieldLabel>
      {input}
      {help && (
        <FieldDescription id={`${id}-${key}-help`}>{help}</FieldDescription>
      )}
      {errors[key] && <FieldError>{errors[key]}</FieldError>}
    </Field>
  );

  return (
    <form
      method="post"
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-4"
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px_140px]">
        {field(
          "name",
          "Service name",
          <Input
            id={`${id}-name`}
            value={values.name}
            maxLength={60}
            aria-invalid={errors.name ? true : undefined}
            onChange={(event) => set("name")(event.target.value)}
            className="h-10"
          />,
        )}
        {field(
          "tokenPrefix",
          "Token prefix",
          <Input
            id={`${id}-tokenPrefix`}
            value={values.tokenPrefix}
            maxLength={3}
            autoCapitalize="characters"
            aria-invalid={errors.tokenPrefix ? true : undefined}
            aria-describedby={`${id}-tokenPrefix-help`}
            onChange={(event) =>
              set("tokenPrefix")(event.target.value.toUpperCase())
            }
            className="h-10 font-display font-extrabold uppercase"
          />,
          "1–3 letters, e.g. B",
        )}
        {field(
          "estimatedDurationMinutes",
          "Minutes per patient",
          <Input
            id={`${id}-estimatedDurationMinutes`}
            type="number"
            inputMode="numeric"
            min={1}
            max={240}
            value={values.estimatedDurationMinutes}
            aria-invalid={errors.estimatedDurationMinutes ? true : undefined}
            onChange={(event) =>
              set("estimatedDurationMinutes")(event.target.value)
            }
            className="h-10 tabular-nums"
          />,
        )}
      </div>
      {field(
        "description",
        "Description (optional)",
        <Textarea
          id={`${id}-description`}
          value={values.description}
          maxLength={200}
          rows={2}
          onChange={(event) => set("description")(event.target.value)}
        />,
        "Shown to patients when they choose a service.",
      )}
      {errors.form && <FieldError>{errors.form}</FieldError>}
      <div>
        <Button
          type="submit"
          disabled={pending}
          className="h-10 rounded-btn px-5 font-semibold"
        >
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function toFormValues(service: AdminServiceView): FormValues {
  return {
    name: service.name,
    description: service.description ?? "",
    tokenPrefix: service.tokenPrefix,
    estimatedDurationMinutes: String(service.estimatedDurationMinutes),
  };
}

export function ServicesManager({
  clinicId,
  services,
}: {
  clinicId: string;
  services: AdminServiceView[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<AdminServiceView | null>(null);
  const [disabling, setDisabling] = useState<AdminServiceView | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function setActive(service: AdminServiceView, isActive: boolean) {
    setBusyId(service.id);
    try {
      await adminRequest(`/api/services/${service.id}`, {
        method: "PATCH",
        body: { isActive },
      });
      toast.success(
        isActive
          ? `${service.name} is back on.`
          : `${service.name} is turned off. Its history is kept.`,
      );
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
      setDisabling(null);
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <AdminSection
        id="add-service"
        title="Add a service"
        description="Patients choose a service when they join. Each service has its own queue and token prefix."
      >
        <ServiceForm
          initial={EMPTY}
          submitLabel="Add service"
          onSubmit={async (data) => {
            await adminRequest(`/api/clinics/${clinicId}/services`, {
              method: "POST",
              body: data,
            });
            toast.success(`${data.name} added. It opens with today's queues.`);
            router.refresh();
          }}
        />
      </AdminSection>

      <AdminSection
        title="Services"
        description="Turning a service off hides it from patients but keeps its tokens and reports."
      >
        {services.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No services yet. Add the first one above.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-divider">
            {services.map((service) => (
              <li
                key={service.id}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center"
              >
                <span
                  aria-hidden
                  className="flex size-11 shrink-0 items-center justify-center rounded-btn bg-cream font-display text-lg font-extrabold text-slate"
                >
                  {service.tokenPrefix}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {service.name}
                    <span className="sr-only">
                      , prefix {service.tokenPrefix}
                    </span>
                    {service.isActive ? (
                      <Pill tone="done">Active</Pill>
                    ) : (
                      <Pill tone="off">Turned off</Pill>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {service.estimatedDurationMinutes} min per patient ·{" "}
                    {service.doctorCount === 0
                      ? "all doctors"
                      : `${service.doctorCount} doctor${service.doctorCount === 1 ? "" : "s"}`}{" "}
                    · {service.totalTokens} tokens so far
                  </p>
                  {service.description && (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {service.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="h-10 rounded-btn"
                    onClick={() => setEditing(service)}
                  >
                    Edit
                  </Button>
                  {service.isActive ? (
                    <Button
                      variant="outline"
                      className="h-10 rounded-btn"
                      disabled={busyId === service.id}
                      onClick={() => setDisabling(service)}
                    >
                      Turn off
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="h-10 rounded-btn"
                      disabled={busyId === service.id}
                      onClick={() => setActive(service, true)}
                    >
                      Turn on
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminSection>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit {editing?.name}</DialogTitle>
            <DialogDescription>
              Changing the prefix only affects new tokens.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <ServiceForm
              key={editing.id}
              initial={toFormValues(editing)}
              submitLabel="Save changes"
              onSubmit={async (data) => {
                await adminRequest(`/api/services/${editing.id}`, {
                  method: "PATCH",
                  body: data,
                });
                toast.success(`${data.name} saved.`);
                setEditing(null);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={disabling !== null}
        onOpenChange={(open) => !open && setDisabling(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Turn off {disabling?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Patients won&apos;t see it and can&apos;t join its queue.
              Reception can still serve anyone already waiting. You can turn it
              back on any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it on</AlertDialogCancel>
            <Button
              disabled={disabling !== null && busyId === disabling.id}
              onClick={() => disabling && setActive(disabling, false)}
            >
              Turn off
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
