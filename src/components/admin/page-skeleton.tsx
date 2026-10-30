import { Skeleton } from "@/components/ui/skeleton";

// Loading state for admin pages while the session and data stream in: the
// header strip, then white card outlines in the page's layout.
export function AdminPageSkeleton({
  label,
  cards = 2,
}: {
  label: string;
  cards?: number;
}) {
  return (
    <div aria-busy="true" className="flex flex-col gap-5">
      <div className="-mx-4 -mt-4 flex items-center gap-3 border-b border-border bg-card px-4 py-4 md:-mx-6 md:-mt-6 md:px-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="hidden h-4 w-40 sm:block" />
      </div>
      {Array.from({ length: cards }, (_, i) => (
        <div
          key={i}
          className="flex flex-col gap-4 rounded-card border border-border bg-card p-5 shadow-card"
        >
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-40 w-full" />
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}
