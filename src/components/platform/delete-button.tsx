"use client";

import { Trash2Icon } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { IconAction } from "./icon-action";
import { errorMessage, requestJson } from "./request";

// Delete behind a confirmation. When the delete isn't allowed the button is
// disabled with the reason beside it, or in the tooltip of the compact icon
// version used in tables (the API refuses too). `confirmText` asks the admin
// to type a value, e.g. a clinic's address.
export function DeleteButton({
  url,
  itemName,
  description,
  blockedReason,
  confirmText,
  body,
  successMessage,
  redirectTo,
  compact = false,
}: {
  url: string;
  // e.g. "Demo Clinic", for "Delete Demo Clinic?"
  itemName: string;
  description: string;
  blockedReason?: string | null;
  confirmText?: string;
  // Sent with the DELETE request; the typed text goes in as `confirmSlug`.
  body?: Record<string, unknown>;
  successMessage: string;
  // Where to go afterwards, e.g. from a detail page back to the list.
  redirectTo?: string;
  // Icon-only button for table rows.
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const buttonClass =
    "h-10 rounded-btn px-4 text-destructive hover:text-destructive";

  if (blockedReason && compact) {
    return (
      <IconAction
        icon={Trash2Icon}
        label={`Delete ${itemName}`}
        tip="Delete"
        blockedReason={blockedReason}
        danger
      />
    );
  }
  if (blockedReason) {
    return (
      <div className="flex max-w-60 flex-col items-start gap-1">
        <Button variant="outline" disabled className={buttonClass}>
          <Trash2Icon aria-hidden />
          Delete
        </Button>
        <p className="text-xs text-muted-foreground">{blockedReason}</p>
      </div>
    );
  }

  const confirmed =
    !confirmText || typed.trim().toLowerCase() === confirmText.toLowerCase();

  async function remove() {
    setPending(true);
    try {
      await requestJson(url, {
        method: "DELETE",
        body: confirmText ? { ...body, confirmSlug: typed.trim() } : body,
      });
      toast.success(successMessage);
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTyped("");
      }}
    >
      <AlertDialogTrigger
        render={
          compact ? (
            <IconAction
              icon={Trash2Icon}
              label={`Delete ${itemName}`}
              tip="Delete"
              danger
            />
          ) : (
            <Button variant="outline" className={buttonClass}>
              <Trash2Icon aria-hidden />
              Delete
              <span className="sr-only"> {itemName}</span>
            </Button>
          )
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {itemName}?</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {confirmText && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirm-delete" className="text-sm font-medium">
              Type <span className="font-mono">{confirmText}</span> to confirm
            </label>
            <Input
              id="confirm-delete"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              className="h-10"
            />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel className="h-10 rounded-btn">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            className="h-10 rounded-btn"
            disabled={pending || !confirmed}
            onClick={remove}
          >
            {pending ? "Deleting…" : "Delete permanently"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
