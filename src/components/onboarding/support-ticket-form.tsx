"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { errorMessage, requestJson } from "@/components/platform/request";
import { useHydrated } from "@/components/platform/use-hydrated";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supportTicketCreateSchema } from "@/features/platform/schemas";

type Errors = { subject?: string; body?: string };

export function SupportTicketForm() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const hydrated = useHydrated();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = supportTicketCreateSchema.safeParse({ subject, body });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof Errors;
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setPending(true);
    try {
      await requestJson("/api/support/tickets", {
        method: "POST",
        body: parsed.data,
      });
      toast.success("Ticket sent. We'll get back to you soon.");
      setSubject("");
      setBody("");
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      method="post"
      noValidate
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-card border border-border bg-card p-5"
    >
      <Field data-invalid={errors.subject ? true : undefined}>
        <FieldLabel htmlFor="subject">Subject</FieldLabel>
        <Input
          id="subject"
          value={subject}
          maxLength={160}
          aria-invalid={errors.subject ? true : undefined}
          onChange={(event) => setSubject(event.target.value)}
          className="h-11"
        />
        <FieldError>{errors.subject}</FieldError>
      </Field>
      <Field data-invalid={errors.body ? true : undefined}>
        <FieldLabel htmlFor="body">What happened?</FieldLabel>
        <Textarea
          id="body"
          value={body}
          rows={5}
          maxLength={5000}
          aria-invalid={errors.body ? true : undefined}
          onChange={(event) => setBody(event.target.value)}
        />
        <FieldError>{errors.body}</FieldError>
      </Field>
      <p className="text-xs text-muted-foreground">
        Please don&apos;t include patient details.
      </p>
      <div>
        <Button
          type="submit"
          disabled={pending || !hydrated}
          className="h-11 rounded-btn px-5 font-semibold"
        >
          {pending ? "Sending…" : "Send ticket"}
        </Button>
      </div>
    </form>
  );
}
