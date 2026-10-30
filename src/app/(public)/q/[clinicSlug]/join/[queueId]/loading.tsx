import { PatientBody } from "@/components/patient/patient-page";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" className="flex flex-1 flex-col">
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-md flex-col gap-2 px-4 py-5">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-8 w-2/3" />
        </div>
      </div>
      <PatientBody>
        <Skeleton className="h-44 rounded-card" />
        <Skeleton className="h-56 rounded-card" />
      </PatientBody>
    </div>
  );
}
