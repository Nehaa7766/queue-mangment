import { Skeleton } from "@/components/ui/skeleton";

// Loading state for the doctor's live screens, shaped like the dashboard.
export function DoctorPanelSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" className="flex flex-col gap-5">
      <Skeleton className="-mx-4 -mt-4 h-16 rounded-none md:-mx-6 md:-mt-6" />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[132px] rounded-card" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton className="h-96 rounded-card" />
        <Skeleton className="h-96 rounded-card" />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
