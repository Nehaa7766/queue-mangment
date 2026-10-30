"use client";

import { TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { HolidayView } from "@/features/clinics/holidays";
import { holidayInputSchema } from "@/features/clinics/schemas";
import { adminRequest, errorMessage } from "./admin-api";

function formatDate(day: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${day}T00:00:00.000Z`));
}

// Whole days the clinic is closed. On those days patients can't join.
export function HolidaysManager({
  clinicId,
  holidays,
  today,
}: {
  clinicId: string;
  holidays: HolidayView[];
  // YYYY-MM-DD in the clinic's timezone.
  today: string;
}) {
  const id = useId();
  const router = useRouter();
  const [values, setValues] = useState({ date: "", name: "" });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [pending, setPending] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = holidayInputSchema.safeParse(values);
    if (!parsed.success) {
      const found: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        found[String(issue.path[0])] ??= issue.message;
      }
      setErrors(found);
      return;
    }
    setErrors({});
    setPending(true);
    try {
      await adminRequest(`/api/clinics/${clinicId}/holidays`, {
        method: "POST",
        body: parsed.data,
      });
      toast.success(`${parsed.data.name} added.`);
      setValues({ date: "", name: "" });
      router.refresh();
    } catch (error) {
      setErrors({ form: errorMessage(error) });
    } finally {
      setPending(false);
    }
  }

  async function remove(holiday: HolidayView) {
    setRemoving(holiday.id);
    try {
      await adminRequest(`/api/clinics/${clinicId}/holidays/${holiday.id}`, {
        method: "DELETE",
      });
      toast.success(`${holiday.name} removed.`);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        method="post"
        onSubmit={handleSubmit}
        noValidate
        className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-start"
      >
        <Field data-invalid={errors.date ? true : undefined}>
          <FieldLabel htmlFor={`${id}-date`}>Date</FieldLabel>
          <Input
            id={`${id}-date`}
            type="date"
            min={today}
            value={values.date}
            aria-invalid={errors.date ? true : undefined}
            onChange={(event) =>
              setValues((v) => ({ ...v, date: event.target.value }))
            }
            className="h-10"
          />
          {errors.date && <FieldError>{errors.date}</FieldError>}
        </Field>
        <Field data-invalid={errors.name ? true : undefined}>
          <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
          <Input
            id={`${id}-name`}
            value={values.name}
            maxLength={80}
            placeholder="e.g. Diwali"
            aria-invalid={errors.name ? true : undefined}
            onChange={(event) =>
              setValues((v) => ({ ...v, name: event.target.value }))
            }
            className="h-10"
          />
          {errors.name && <FieldError>{errors.name}</FieldError>}
        </Field>
        <Button
          type="submit"
          disabled={pending}
          className="h-10 rounded-btn px-5 font-semibold sm:mt-[26px]"
        >
          {pending ? "Adding…" : "Add holiday"}
        </Button>
        {errors.form && (
          <FieldError className="sm:col-span-3">{errors.form}</FieldError>
        )}
      </form>

      {holidays.length === 0 ? (
        <p className="text-sm text-muted-foreground">No holidays added.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-divider">
          {holidays.map((holiday) => {
            const past = holiday.date < today;
            return (
              <li
                key={holiday.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span className={past ? "text-muted-foreground" : undefined}>
                  <span className="text-sm font-semibold">{holiday.name}</span>
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    {formatDate(holiday.date)}
                    {past && " · past"}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10 rounded-btn"
                  aria-label={`Remove ${holiday.name}`}
                  disabled={removing === holiday.id}
                  onClick={() => remove(holiday)}
                >
                  <TrashIcon aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
