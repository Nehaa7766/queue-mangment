"use client";

import { PowerIcon, RotateCcwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { UserStatus } from "@/generated/prisma/enums";
import { IconAction } from "./icon-action";
import { errorMessage, requestJson } from "./request";

// Deactivate or reactivate a user (row action).
export function UserStatusButton({
  userId,
  name,
  status,
  isSelf,
}: {
  userId: string;
  name: string;
  status: UserStatus;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const next = status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  const action = next === "ACTIVE" ? "Reactivate" : "Deactivate";

  async function change() {
    setPending(true);
    try {
      await requestJson(`/api/platform/users/${userId}`, {
        method: "PATCH",
        body: { status: next },
      });
      toast.success(
        next === "ACTIVE"
          ? `${name} can sign in again.`
          : `${name} is signed out and can't sign in.`,
      );
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <IconAction
      icon={next === "ACTIVE" ? RotateCcwIcon : PowerIcon}
      label={`${action} ${name}`}
      tip={action}
      blockedReason={
        isSelf && next === "INACTIVE"
          ? "You can't deactivate your own account."
          : null
      }
      danger={next === "INACTIVE"}
      disabled={pending}
      onClick={change}
    />
  );
}
