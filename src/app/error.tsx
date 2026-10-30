"use client";

import { useEffect } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // In production, server errors only carry a digest that matches the server log.
  const digest =
    error instanceof Error && "digest" in error
      ? String((error as Error & { digest?: string }).digest)
      : null;

  return (
    <AuthShell
      title="Something went wrong"
      description="This page didn't load. Try again, and if it keeps happening tell your clinic admin."
    >
      <Button
        type="button"
        onClick={() => retry()}
        className="h-11 w-full rounded-btn font-semibold"
      >
        Try again
      </Button>
      {digest && (
        <p className="text-xs text-muted-foreground">Reference: {digest}</p>
      )}
    </AuthShell>
  );
}
