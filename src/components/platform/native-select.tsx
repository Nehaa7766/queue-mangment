import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// A plain <select> styled like the other inputs. Native controls keep forms
// simple and fully keyboard and screen-reader friendly.
export function NativeSelect({
  className,
  ...props
}: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}
