import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div
      className="overflow-hidden rounded-card border border-border bg-card"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-2 bg-slate px-6 pt-5 pb-6">
        <Skeleton className="h-3 w-20 bg-slate-hover" />
        <Skeleton className="h-14 w-36 bg-slate-hover" />
        <Skeleton className="h-4 w-24 bg-slate-hover" />
      </div>
      <div className="flex flex-col gap-4 p-5">
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-24 rounded-card" />
      </div>
    </div>
  );
}
