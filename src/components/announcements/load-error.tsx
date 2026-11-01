import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Error card for the announcement screens, in the style of the panels'
// error pages. `backHref` replaces the retry when retrying can't help.
export function LoadError({
  title,
  message,
  onRetry,
  backHref,
  backLabel,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-card border border-border bg-card px-6 py-10 text-center shadow-card"
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{message}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {onRetry && (
          <Button className="h-10 rounded-btn px-5" onClick={onRetry}>
            Try again
          </Button>
        )}
        {backHref && (
          <Link
            href={backHref}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-10 rounded-btn px-5",
            )}
          >
            {backLabel ?? "Back"}
          </Link>
        )}
      </div>
    </div>
  );
}
