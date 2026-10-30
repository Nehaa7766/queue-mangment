"use client";

import { Button } from "@/components/ui/button";

// Error state for every admin page. Details stay in the server logs.
export default function AdminError({ retry }: { retry: () => void }) {
  return (
    <div
      role="alert"
      className="mx-auto mt-6 flex max-w-md flex-col items-center gap-3 rounded-card border border-border bg-card px-6 py-10 text-center shadow-card"
    >
      <h1 className="text-lg font-semibold">This page couldn&apos;t load</h1>
      <p className="text-sm text-muted-foreground">
        Check the connection and try again. If it keeps happening, sign out and
        back in.
      </p>
      <Button className="h-10 rounded-btn px-5" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
