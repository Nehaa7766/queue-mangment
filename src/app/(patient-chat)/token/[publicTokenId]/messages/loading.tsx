import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div
      className="mx-auto flex h-full w-full max-w-md flex-col bg-card"
      aria-busy="true"
    >
      <div className="flex items-center gap-3 border-b border-divider px-3 py-3">
        <Skeleton className="size-10 rounded-btn" />
        <Skeleton className="size-10 rounded-full" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3.5 w-40" />
        </div>
      </div>
      <Skeleton className="m-3 h-10 rounded-btn" />
      <div className="flex flex-1 flex-col justify-end gap-3 bg-background p-4">
        <Skeleton className="h-12 w-3/5 rounded-card" />
        <Skeleton className="ml-auto h-12 w-2/3 rounded-card" />
        <Skeleton className="h-12 w-1/2 rounded-card" />
      </div>
      <Skeleton className="m-3 h-12 rounded-btn" />
    </div>
  );
}
