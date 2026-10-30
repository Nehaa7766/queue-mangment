import { cn } from "@/lib/utils";

// "Updated 12s ago" under live doctor screens, or a warning when polling fails.
export function SyncStatus({
  lastSynced,
  now,
  refreshFailed,
  className,
}: {
  lastSynced: number;
  now: number;
  refreshFailed: boolean;
  className?: string;
}) {
  const seconds = Math.max(0, Math.round((now - lastSynced) / 1000));
  return (
    <p
      className={cn(
        "text-xs tabular-nums",
        refreshFailed ? "text-destructive" : "text-muted-foreground",
        className,
      )}
    >
      {refreshFailed
        ? "Couldn't refresh. Retrying every 15 seconds."
        : `Updates by itself · ${seconds < 5 ? "just now" : `${seconds}s ago`}`}
    </p>
  );
}
