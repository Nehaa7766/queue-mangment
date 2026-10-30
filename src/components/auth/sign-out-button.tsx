"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ComponentProps } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export function SignOutButton({
  variant = "outline",
  className,
  iconOnly = false,
}: Pick<ComponentProps<typeof Button>, "variant" | "className"> & {
  // For the collapsed sidebar: the label stays for screen readers and as a tooltip.
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    const { error } = await authClient.signOut();
    if (error) {
      setPending(false);
      toast.error("We couldn't sign you out. Please try again.");
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant={variant}
      disabled={pending}
      onClick={handleSignOut}
      title={iconOnly ? "Sign out" : undefined}
      className={className}
    >
      <LogOut aria-hidden="true" />
      <span className={iconOnly ? "sr-only" : undefined}>
        {pending ? "Signing out…" : "Sign out"}
      </span>
    </Button>
  );
}
