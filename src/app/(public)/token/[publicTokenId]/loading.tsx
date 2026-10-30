import { PatientBody } from "@/components/patient/patient-page";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PatientBody>
      <div
        className="overflow-hidden rounded-card border border-border bg-card shadow-card"
        aria-busy="true"
      >
        <div className="flex flex-col items-center gap-2 bg-brand px-6 pt-6 pb-7">
          <Skeleton className="h-3 w-20 bg-white/20" />
          <Skeleton className="h-14 w-36 bg-white/20" />
          <Skeleton className="h-4 w-24 bg-white/20" />
        </div>
        <div className="flex flex-col gap-4 p-5">
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-6 w-2/3" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-24 rounded-card" />
            <Skeleton className="h-24 rounded-card" />
          </div>
        </div>
      </div>
    </PatientBody>
  );
}
