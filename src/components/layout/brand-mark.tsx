import { cn } from "@/lib/utils";

// 36px slate square with a sand "Q" (docs/PLAN.md §12.6).
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-slate font-display text-lg font-extrabold text-sand",
        className,
      )}
    >
      Q
    </span>
  );
}
