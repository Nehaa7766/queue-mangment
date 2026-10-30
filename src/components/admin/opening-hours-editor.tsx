"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  defaultDay,
  fromHoursForm,
  MAX_RANGES_PER_DAY,
  toHoursForm,
  validateHoursForm,
  WEEKDAY_LABELS,
  WEEKDAYS,
  type HoursForm,
  type HoursFormErrors,
  type OpeningHours,
  type Weekday,
} from "@/features/clinics/opening-hours";
import { errorMessage } from "./admin-api";
import { CheckboxField } from "./admin-ui";
import { useSettingsSave } from "./settings-forms";

// Weekly opening hours. Patients can only join while the clinic is open;
// with hours switched off the clinic counts as always open.
export function OpeningHoursEditor({
  clinicId,
  initial,
  onSave,
}: {
  clinicId: string;
  initial: OpeningHours | null;
  // For tests; defaults to saving through the settings API.
  onSave?: (hours: OpeningHours | null) => Promise<void>;
}) {
  const id = useId();
  const saveSettings = useSettingsSave(clinicId);
  const [form, setForm] = useState<HoursForm>(() => toHoursForm(initial));
  const [errors, setErrors] = useState<HoursFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const updateDay = (
    day: Weekday,
    change: (value: HoursForm["days"][Weekday]) => HoursForm["days"][Weekday],
  ) =>
    setForm((current) => ({
      ...current,
      days: { ...current.days, [day]: change(current.days[day]) },
    }));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validateHoursForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setFormError(null);
    setPending(true);
    const hours = fromHoursForm(form);
    try {
      if (onSave) await onSave(hours);
      else
        await saveSettings(
          { section: "hours", openingHours: hours },
          "Opening hours saved.",
        );
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      method="post"
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-4"
    >
      <CheckboxField
        label="Set opening hours"
        description="Off means patients can join at any time."
        checked={form.enabled}
        onChange={(event) =>
          setForm((current) => ({ ...current, enabled: event.target.checked }))
        }
      />

      {form.enabled && (
        <ul className="flex flex-col divide-y divide-divider">
          {WEEKDAYS.map((day) => {
            const value = form.days[day];
            const error = errors[day];
            const errorId = `${id}-${day}-error`;
            return (
              <li
                key={day}
                className="grid gap-2 py-3 md:grid-cols-[160px_minmax(0,1fr)] md:items-start"
              >
                <CheckboxField
                  label={WEEKDAY_LABELS[day]}
                  description={value.open ? undefined : "Closed"}
                  checked={value.open}
                  className="py-1"
                  onChange={(event) =>
                    updateDay(day, (current) => ({
                      ...current,
                      open: event.target.checked,
                    }))
                  }
                />
                {value.open && (
                  <div className="flex flex-col gap-2">
                    {value.ranges.map((range, index) => (
                      <div
                        key={index}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <Input
                          type="time"
                          aria-label={`${WEEKDAY_LABELS[day]} opening ${index + 1}`}
                          aria-invalid={error ? true : undefined}
                          aria-describedby={error ? errorId : undefined}
                          value={range.start}
                          onChange={(event) =>
                            updateDay(day, (current) => ({
                              ...current,
                              ranges: current.ranges.map((item, i) =>
                                i === index
                                  ? { ...item, start: event.target.value }
                                  : item,
                              ),
                            }))
                          }
                          className="h-10 w-32 tabular-nums"
                        />
                        <span aria-hidden className="text-muted-foreground">
                          –
                        </span>
                        <Input
                          type="time"
                          aria-label={`${WEEKDAY_LABELS[day]} closing ${index + 1}`}
                          aria-invalid={error ? true : undefined}
                          aria-describedby={error ? errorId : undefined}
                          value={range.end}
                          onChange={(event) =>
                            updateDay(day, (current) => ({
                              ...current,
                              ranges: current.ranges.map((item, i) =>
                                i === index
                                  ? { ...item, end: event.target.value }
                                  : item,
                              ),
                            }))
                          }
                          className="h-10 w-32 tabular-nums"
                        />
                        {value.ranges.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-10 rounded-btn"
                            aria-label={`Remove ${WEEKDAY_LABELS[day]} time ${index + 1}`}
                            onClick={() =>
                              updateDay(day, (current) => ({
                                ...current,
                                ranges: current.ranges.filter(
                                  (_, i) => i !== index,
                                ),
                              }))
                            }
                          >
                            <XIcon aria-hidden />
                          </Button>
                        )}
                      </div>
                    ))}
                    {value.ranges.length < MAX_RANGES_PER_DAY && (
                      <div>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-9 rounded-btn px-2 text-slate"
                          onClick={() =>
                            updateDay(day, (current) => ({
                              ...current,
                              ranges: [
                                ...current.ranges,
                                { start: "17:00", end: "20:00" },
                              ],
                            }))
                          }
                        >
                          <PlusIcon aria-hidden /> Add a break or evening hours
                        </Button>
                      </div>
                    )}
                    {error && <FieldError id={errorId}>{error}</FieldError>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {form.enabled && (
        <div>
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-btn"
            onClick={() =>
              setForm((current) => ({
                ...current,
                days: Object.fromEntries(
                  WEEKDAYS.map((day) => [day, defaultDay(day)]),
                ) as HoursForm["days"],
              }))
            }
          >
            Reset to Mon–Sat, 09:00–17:00
          </Button>
        </div>
      )}

      {formError && <FieldError>{formError}</FieldError>}
      <div>
        <Button
          type="submit"
          disabled={pending}
          className="h-10 rounded-btn px-5 font-semibold"
        >
          {pending ? "Saving…" : "Save opening hours"}
        </Button>
      </div>
    </form>
  );
}
