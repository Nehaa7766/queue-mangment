import { Skeleton } from "@/components/ui/skeleton";

// Loading state for admin pages while the session and data stream in.
export function AdminPageSkeleton({
  label,
  cards = 2,
}: {
  label: string;
  cards?: number;
}) {
  return (
    <div aria-busy="true" className="flex flex-col gap-3.5">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-64" />
      {Array.from({ length: cards }, (_, i) => (
        <Skeleton key={i} className="h-56 rounded-card" />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}
