import { PatientBody } from "@/components/patient/patient-page";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" className="flex flex-1 flex-col">
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-md flex-col gap-2 px-4 py-5">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <PatientBody>
        <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
          <div className="flex flex-col gap-2 border-b border-divider px-5 py-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex items-center gap-3.5 px-5 py-4">
              <Skeleton className="size-11 rounded-btn" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </PatientBody>
    </div>
  );
}
