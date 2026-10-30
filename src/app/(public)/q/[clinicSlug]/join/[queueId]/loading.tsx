import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-8 w-2/3" />
      </div>
      <Skeleton className="h-40 rounded-card" />
      <Skeleton className="h-20 rounded-card" />
      <Skeleton className="h-14 rounded-btn" />
    </div>
  );
}
