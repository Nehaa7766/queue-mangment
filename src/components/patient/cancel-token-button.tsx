"use client";

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
import type { PublicTokenView } from "@/features/queue/contracts";
import { cancelPublicToken } from "./api-client";
import { messages } from "./messages";

const m = messages.cancel;

// Leaving the queue can't be undone, so it always asks first.
export function CancelTokenButton({
  publicTokenId,
  onCancelled,
}: {
  publicTokenId: string;
  onCancelled: (token: PublicTokenView) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    if (pending) {
      return;
    }
    setPending(true);
    const result = await cancelPublicToken(publicTokenId);
    setPending(false);
    if (result.ok) {
      setOpen(false);
      onCancelled(result.data.token);
      toast.success(m.done);
    } else {
      toast.error(m.failed);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            variant="outline"
            className="h-12 w-full rounded-btn text-base"
          />
        }
      >
        {m.trigger}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{m.title}</AlertDialogTitle>
          <AlertDialogDescription>{m.body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-12 rounded-btn text-base">
            {m.keep}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            className="h-12 rounded-btn text-base"
            disabled={pending}
            onClick={handleConfirm}
          >
            {m.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
