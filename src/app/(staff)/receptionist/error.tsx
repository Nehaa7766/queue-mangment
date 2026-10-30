"use client";

import { Button } from "@/components/ui/button";

// Error state for every reception page. Details stay in the server logs.
export default function ReceptionError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-card border border-border bg-card px-6 py-10 text-center"
    >
      <h1 className="font-display text-xl font-bold">
        This page couldn&apos;t load
      </h1>
      <p className="text-sm text-muted-foreground">
        Check the connection and try again. If it keeps happening, sign out and
        back in.
      </p>
      <Button className="h-10 rounded-btn px-5" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
