import { Skeleton } from "@/components/ui/skeleton";

// Loading state for the doctor's live screens.
export function DoctorPanelSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton
            key={i}
            className="h-[104px] rounded-card last:col-span-2 lg:last:col-span-1"
          />
        ))}
      </div>
      <Skeleton className="h-40 rounded-card" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-14 rounded-[10px]" />
        ))}
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
