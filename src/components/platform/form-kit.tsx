"use client";

import type { ReactNode } from "react";
import type { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "./native-select";

// Shared pieces for the super-admin add and edit forms: a side panel with a
// pinned footer, labelled fields with inline errors, and Zod error mapping.

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

// The first message per field, keyed by the top-level field name. Fields
// of a `nested` object (e.g. "hours") are keyed by their own name instead.
export function fieldErrors<K extends string>(
  error: z.ZodError,
  nested: readonly string[] = [],
): FieldErrors<K> {
  const errors: FieldErrors<K> = {};
  for (const issue of error.issues) {
    const [first, second] = issue.path;
    const key = (
      typeof first === "string" &&
      nested.includes(first) &&
      second !== undefined
        ? second
        : first
    ) as K | undefined;
    if (key !== undefined) errors[key] ??= issue.message;
  }
  return errors;
}

// Shown in the sheet footer when the form's own checks fail. The forms are
// long, so it sits by the button and the first bad field gets focus, or it
// would look like nothing happened.
export const INVALID_FORM_MESSAGE =
  "Some details need fixing. They're marked in red.";

// After a failed submit, scroll to and focus the first field marked invalid
// (once React has rendered the errors).
export function focusFirstInvalid(formId: string) {
  requestAnimationFrame(() => {
    const field = document
      .getElementById(formId)
      ?.querySelector<HTMLElement>('[aria-invalid="true"]');
    field?.scrollIntoView({ block: "center", behavior: "smooth" });
    field?.focus({ preventScroll: true });
  });
}

// Side panel for one form. The footer sits outside the form's scroll area,
// so its submit button points at the form by id. A request that fails shows
// its `error` in the footer, always in view; a toast would cover the buttons
// and disappear.
export function FormSheet({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  footer,
  error,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactElement;
  title: string;
  description?: string;
  footer?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger && <SheetTrigger render={trigger} />}
      <SheetContent
        side="right"
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
      >
        <SheetHeader className="border-b border-divider px-5 py-4 pr-12">
          <SheetTitle className="text-base font-semibold">{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <SheetFooter className="mt-0 gap-3 border-t border-divider px-5 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-row justify-end gap-2">{footer}</div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

// A titled group of fields inside a form.
export function FormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-3 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

type BaseFieldProps = {
  id: string;
  label: string;
  error?: string;
  description?: ReactNode;
};

export function TextField({
  id,
  label,
  error,
  description,
  value,
  onChange,
  type = "text",
  ...input
}: BaseFieldProps & {
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "tel" | "number" | "time";
} & Omit<React.ComponentProps<"input">, "id" | "value" | "onChange" | "type">) {
  const describedBy = description ? `${id}-description` : undefined;
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="h-10"
        {...input}
      />
      {description && (
        <FieldDescription id={describedBy}>{description}</FieldDescription>
      )}
      <FieldError>{error}</FieldError>
    </Field>
  );
}

export function TextAreaField({
  id,
  label,
  error,
  description,
  value,
  onChange,
  rows = 5,
}: BaseFieldProps & {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  const describedBy = description ? `${id}-description` : undefined;
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {description && (
        <FieldDescription id={describedBy}>{description}</FieldDescription>
      )}
      <FieldError>{error}</FieldError>
    </Field>
  );
}

export function SelectField({
  id,
  label,
  error,
  description,
  value,
  onChange,
  options,
  disabled,
}: BaseFieldProps & {
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  disabled?: boolean;
}) {
  const describedBy = description ? `${id}-description` : undefined;
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <NativeSelect
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
      {description && (
        <FieldDescription id={describedBy}>{description}</FieldDescription>
      )}
      <FieldError>{error}</FieldError>
    </Field>
  );
}

export function CheckboxField({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
}: Omit<BaseFieldProps, "error"> & {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const describedBy = description ? `${id}-description` : undefined;
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        aria-describedby={describedBy}
        className="mt-0.5 size-5 shrink-0 rounded accent-brand disabled:opacity-50"
      />
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {description && (
          <p id={describedBy} className="text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
