"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { UserStatus } from "@/generated/prisma/enums";
import { errorMessage, requestJson } from "./request";

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
    <Button
      variant="outline"
      className="h-10 rounded-btn px-3"
      disabled={pending || (isSelf && next === "INACTIVE")}
      title={isSelf ? "You can't deactivate your own account." : undefined}
      onClick={change}
    >
      {next === "ACTIVE" ? "Reactivate" : "Deactivate"}
      <span className="sr-only"> {name}</span>
    </Button>
  );
}
