"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ClinicLifecycle } from "@/features/platform/lifecycle";
import { errorMessage, requestJson } from "./request";

// Approve a pending clinic, lift a suspension, or suspend an active clinic.
// Suspending is confirmed first: it locks out every staff member at once.
export function ClinicStatusButton({
  clinicId,
  clinicName,
  lifecycle,
}: {
  clinicId: string;
  clinicName: string;
  lifecycle: ClinicLifecycle;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);

  async function change(status: "ACTIVE" | "INACTIVE") {
    setPending(true);
    try {
      await requestJson(`/api/platform/clinics/${clinicId}`, {
        method: "PATCH",
        body: { status },
      });
      toast.success(
        status === "ACTIVE"
          ? `${clinicName} is active.`
          : `${clinicName} is suspended.`,
      );
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  if (lifecycle !== "ACTIVE") {
    return (
      <Button
        className="h-10 rounded-btn px-4 font-semibold"
        disabled={pending}
        onClick={() => change("ACTIVE")}
      >
        {lifecycle === "PENDING" ? "Approve clinic" : "Reactivate clinic"}
      </Button>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant="outline" className="h-10 rounded-btn px-4">
            Suspend clinic
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Suspend {clinicName}?</AlertDialogTitle>
          <AlertDialogDescription>
            Staff are signed out of the clinic&apos;s screens and the public
            queue page goes offline. Nothing is deleted; you can reactivate it
            later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-10 rounded-btn">
            Keep active
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            className="h-10 rounded-btn"
            disabled={pending}
            onClick={() => change("INACTIVE")}
          >
            {pending ? "Suspending…" : "Suspend clinic"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
